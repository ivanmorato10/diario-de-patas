/**
 * Cartinhas, ossinhos e o nome de quem usa.
 * - Cartinha: texto para o cachorro, com data. Escreve quem pode editar; altera/apaga quem escreveu ou o administrador.
 * - Ossinho: o "curtir" do app, em fotos e cartinhas de OUTRAS pessoas; qualquer pessoa da família dá (inclusive "só ver").
 * - Nome: "Como a família te chama?" — usado em "guardada por", "cartinha de" e nos ossinhos.
 */
import "server-only";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { currentDog, requireEditor } from "./family";
import { adminClient, HttpError } from "./supabase";
import { notifyFamily } from "./notify";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctx = { supa: SupabaseClient; user: User };
const bad = (code: string, message: string) => new HttpError(400, code, message);
const civil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const LETTER_MAX = 3000;

export async function setMyName(ctx: Ctx, args: unknown) {
  const name = z.object({ name: z.string() }).parse(args).name.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!name) throw bad("NAME_REQUIRED", "Conte como a família te chama.");
  const { error } = await adminClient().from("profiles").upsert({ user_id: ctx.user.id, display_name: name, name_confirmed: true }, { onConflict: "user_id" });
  if (error) throw new HttpError(500, "SERVER", "Não deu para salvar o nome agora.");
  return { name };
}

const LetterIn = z.object({ body: z.string(), date: civil });
const clean = (body: string) => {
  const b = body.replace(/\r\n/g, "\n").trim();
  if (!b) throw bad("EMPTY", "Escreva alguma coisa na cartinha.");
  if (b.length > LETTER_MAX) throw bad("TOO_LONG", `A cartinha pode ter até ${LETTER_MAX} caracteres.`);
  return b;
};
const todayCheck = (date: string) => {
  if (date > new Date(Date.now() + 14 * 3600_000).toISOString().slice(0, 10)) throw bad("INVALID", "Escolha uma data até hoje.");
};

export async function saveLetter(ctx: Ctx, args: unknown) {
  const a = LetterIn.extend({ requestKey: z.string().uuid() }).parse(args);
  const dog = (await currentDog(ctx))!;
  requireEditor(dog);
  todayCheck(a.date);
  const admin = adminClient();
  const prior = (await admin.from("letters").select("id").eq("dog_id", dog.id).eq("request_key", a.requestKey).maybeSingle()).data as any;
  if (prior) return { id: prior.id }; // toque duplo: a mesma cartinha
  const { data, error } = await admin.from("letters").insert({ dog_id: dog.id, created_by: ctx.user.id, body: clean(a.body), letter_date: a.date, request_key: a.requestKey }).select("id").single();
  if (error) throw new HttpError(500, "SERVER", "Não deu para guardar a cartinha agora.");
  notifyFamily(ctx, { dogId: dog.id, dogName: dog.name, kind: "letter", targetType: "letter", targetId: (data as any).id });
  return { id: (data as any).id };
}

async function ownLetter(ctx: Ctx, id: string) {
  const dog = (await currentDog(ctx))!;
  requireEditor(dog);
  const l = (await adminClient().from("letters").select("id, created_by").eq("id", id).eq("dog_id", dog.id).maybeSingle()).data as any;
  if (!l) throw new HttpError(404, "NOT_FOUND", "Cartinha não encontrada.");
  if (l.created_by !== ctx.user.id && dog.role !== "admin") throw new HttpError(403, "NOT_AUTHOR", "Só quem escreveu a cartinha pode mudar.");
  return l;
}

export async function updateLetter(ctx: Ctx, args: unknown) {
  const a = LetterIn.extend({ id: z.string().uuid() }).parse(args);
  await ownLetter(ctx, a.id);
  todayCheck(a.date);
  await adminClient().from("letters").update({ body: clean(a.body), letter_date: a.date, updated_at: new Date().toISOString() }).eq("id", a.id);
  return {};
}

export async function deleteLetter(ctx: Ctx, args: unknown) {
  const { id } = z.object({ id: z.string().uuid() }).parse(args);
  await ownLetter(ctx, id);
  await adminClient().from("letters").delete().eq("id", id);
  return {};
}

/** Dá ou tira o ossinho. Não vale na própria foto/cartinha. */
export async function toggleBone(ctx: Ctx, args: unknown) {
  const a = z.object({ targetType: z.enum(["entry", "letter"]), targetId: z.string().uuid() }).parse(args);
  const dog = (await currentDog(ctx))!;
  const admin = adminClient();
  const target = a.targetType === "entry"
    ? (await admin.from("diary_entries").select("created_by").eq("id", a.targetId).eq("dog_id", dog.id).is("deleted_at", null).maybeSingle()).data as any
    : (await admin.from("letters").select("created_by").eq("id", a.targetId).eq("dog_id", dog.id).maybeSingle()).data as any;
  if (!target) throw new HttpError(404, "NOT_FOUND", "Não encontrada.");
  if (target.created_by === ctx.user.id) throw bad("OWN", "O ossinho é para as lembranças de outras pessoas da família.");
  const key = { target_type: a.targetType, target_id: a.targetId, user_id: ctx.user.id };
  const { data: had } = await admin.from("bones").select("user_id").match(key).maybeSingle();
  if (had) await admin.from("bones").delete().match(key);
  else {
    await admin.from("bones").insert({ ...key, dog_id: dog.id });
    notifyFamily(ctx, { dogId: dog.id, dogName: dog.name, kind: "bone", targetType: a.targetType, targetId: a.targetId, authorId: target.created_by });
  }
  return { given: !had };
}
