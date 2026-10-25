/**
 * Cartinhas, ossinhos e o nome de quem usa.
 * - Cartinha: texto para o cachorro, com data. Escreve quem pode editar; altera/apaga quem escreveu ou o administrador.
 * - Ossinho: o "curtir" do app, em fotos e cartinhas de OUTRAS pessoas; qualquer pessoa da família dá (inclusive "só ver").
 * - Nome: "Qual é o seu nome?" (da pessoa) — usado em "guardada por", "cartinha de" e nos ossinhos.
 */
import "server-only";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { currentDog, requireEditor } from "./family";
import { adminClient, HttpError } from "./supabase";
import { must, mustRow } from "./db";
import { civilDateInTz } from "@/domain/dates";
import { notifyFamily } from "./notify";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctx = { supa: SupabaseClient; user: User };
const bad = (code: string, message: string, params?: Record<string, string | number>) => new HttpError(400, code, message, params);
const civil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const LETTER_MAX = 3000;

export async function setMyName(ctx: Ctx, args: unknown) {
  const name = z.object({ name: z.string() }).parse(args).name.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!name) throw bad("NAME_REQUIRED", "errors.myNameRequired");
  const { error } = await adminClient().from("profiles").upsert({ user_id: ctx.user.id, display_name: name, name_confirmed: true }, { onConflict: "user_id" });
  if (error) throw new HttpError(500, "SERVER", "errors.myNameSaveFailed");
  return { name };
}

const LetterIn = z.object({ body: z.string(), date: civil });
const clean = (body: string) => {
  const b = body.replace(/\r\n/g, "\n").trim();
  if (!b) throw bad("EMPTY", "errors.letterEmpty");
  if (b.length > LETTER_MAX) throw bad("TOO_LONG", "errors.letterTooLong", { max: LETTER_MAX });
  return b;
};
/** Até hoje no fuso de quem escreve (o mesmo "hoje" que a tela mostra), não no fuso mais adiantado do mundo. */
const todayCheck = async (ctx: Ctx, date: string) => {
  const prof = (await must(adminClient().from("profiles").select("timezone").eq("user_id", ctx.user.id).maybeSingle(), "errors.letterSaveFailed")) as { timezone?: string | null } | null;
  if (date > civilDateInTz(new Date(), prof?.timezone || "America/Sao_Paulo")) throw bad("INVALID", "errors.dateUpToToday");
};

export async function saveLetter(ctx: Ctx, args: unknown) {
  const a = LetterIn.extend({ requestKey: z.string().uuid() }).parse(args);
  const dog = (await currentDog(ctx))!;
  requireEditor(dog);
  await todayCheck(ctx, a.date);
  const admin = adminClient();
  const prior = (await must(admin.from("letters").select("id").eq("dog_id", dog.id).eq("request_key", a.requestKey).maybeSingle(), "errors.letterSaveFailed")) as any;
  if (prior) return { id: prior.id }; // toque duplo: a mesma cartinha
  const { data, error } = await admin.from("letters").insert({ dog_id: dog.id, created_by: ctx.user.id, body: clean(a.body), letter_date: a.date, request_key: a.requestKey }).select("id").single();
  if (error) throw new HttpError(500, "SERVER", "errors.letterSaveFailed");
  notifyFamily(ctx, { dogId: dog.id, dogName: dog.name, kind: "letter", targetType: "letter", targetId: (data as any).id });
  return { id: (data as any).id };
}

async function ownLetter(ctx: Ctx, id: string) {
  const dog = (await currentDog(ctx))!;
  requireEditor(dog);
  const l = (await must(adminClient().from("letters").select("id, created_by").eq("id", id).eq("dog_id", dog.id).maybeSingle())) as any;
  if (!l) throw new HttpError(404, "NOT_FOUND", "errors.letterNotFound");
  if (l.created_by !== ctx.user.id && dog.role !== "admin") throw new HttpError(403, "NOT_AUTHOR", "errors.notAuthor");
  return l;
}

export async function updateLetter(ctx: Ctx, args: unknown) {
  const a = LetterIn.extend({ id: z.string().uuid() }).parse(args);
  await ownLetter(ctx, a.id);
  await todayCheck(ctx, a.date);
  await mustRow(adminClient().from("letters").update({ body: clean(a.body), letter_date: a.date, updated_at: new Date().toISOString() }).eq("id", a.id).select("id"), "errors.letterNotFound", "errors.letterSaveFailed");
  return {};
}

export async function deleteLetter(ctx: Ctx, args: unknown) {
  const { id } = z.object({ id: z.string().uuid() }).parse(args);
  await ownLetter(ctx, id);
  await mustRow(adminClient().from("letters").delete().eq("id", id).select("id"), "errors.letterNotFound");
  return {};
}

/** Dá ou tira o ossinho. Não vale na própria foto/cartinha. */
export async function toggleBone(ctx: Ctx, args: unknown) {
  const a = z.object({ targetType: z.enum(["entry", "letter"]), targetId: z.string().uuid() }).parse(args);
  const dog = (await currentDog(ctx))!;
  const admin = adminClient();
  const target = (a.targetType === "entry"
    ? await must(admin.from("diary_entries").select("created_by").eq("id", a.targetId).eq("dog_id", dog.id).is("deleted_at", null).maybeSingle())
    : await must(admin.from("letters").select("created_by").eq("id", a.targetId).eq("dog_id", dog.id).maybeSingle())) as any;
  if (!target) throw new HttpError(404, "NOT_FOUND", "errors.notFoundShort");
  if (target.created_by === ctx.user.id) throw bad("OWN", "errors.ownBone");
  const key = { target_type: a.targetType, target_id: a.targetId, user_id: ctx.user.id };
  // Só responde "dei/tirei" depois de o banco confirmar (antes, um erro no insert respondia given: true).
  const had = await must(admin.from("bones").select("user_id").match(key).maybeSingle());
  if (had) {
    await must(admin.from("bones").delete().match(key));
    return { given: false };
  }
  const { error } = await admin.from("bones").insert({ ...key, dog_id: dog.id });
  if (error && error.code !== "23505") await must(Promise.resolve({ data: null, error })); // 23505: toque duplo, já estava dado
  if (!error) notifyFamily(ctx, { dogId: dog.id, dogName: dog.name, kind: "bone", targetType: a.targetType, targetId: a.targetId, authorId: target.created_by });
  return { given: true };
}
