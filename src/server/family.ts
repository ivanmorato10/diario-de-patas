/**
 * Vários cachorros por pessoa e família (administrador, pode editar, só ver).
 * - O diário aberto é profiles.current_dog_id (validado contra dog_members); sem ele, o primeiro da pessoa.
 * - dog.owner_id é o dono do diário: é ele que vai em owner_id dos registros (funções de missão/créditos
 *   continuam iguais); quem fez fica em created_by.
 * - Convite: código curto (hash), papel, 7 dias, uso único. Quem recebe entra com a PRÓPRIA conta e aceita.
 */
import "server-only";
import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { adminClient, HttpError } from "./supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctx = { supa: SupabaseClient; user: User };
export type Role = "admin" | "editor" | "viewer";
export interface CurrentDog { id: string; owner_id: string; role: Role; [k: string]: any }

const bad = (code: string, message: string) => new HttpError(400, code, message);
const cache = new WeakMap<object, CurrentDog | null>();

/** Diário aberto agora (com o papel da pessoa nele). */
export async function currentDog(ctx: Ctx, required = true): Promise<CurrentDog | null> {
  if (cache.has(ctx)) {
    const c = cache.get(ctx)!;
    if (!c && required) throw bad("NO_DOG", "Crie o diário antes.");
    return c;
  }
  const admin = adminClient();
  const [{ data: prof }, { data: mem }] = await Promise.all([
    admin.from("profiles").select("current_dog_id").eq("user_id", ctx.user.id).maybeSingle(),
    // O cachorro vem junto da participação: uma ida ao banco a menos em toda operação.
    admin.from("dog_members").select("dog_id, role, created_at, dogs!inner(*)").eq("user_id", ctx.user.id).order("created_at"),
  ]);
  const members = (mem ?? []) as { dog_id: string; role: Role; dogs: any }[];
  const m = members.find((x) => x.dog_id === (prof as any)?.current_dog_id) ?? members[0];
  const dog: CurrentDog | null = m?.dogs ? { ...m.dogs, role: m.role } : null;
  cache.set(ctx, dog);
  if (!dog && required) throw bad("NO_DOG", "Crie o diário antes.");
  return dog;
}

export function forgetDog(ctx: Ctx) {
  cache.delete(ctx);
}

export function requireEditor(dog: CurrentDog) {
  if (dog.role === "viewer") throw new HttpError(403, "VIEW_ONLY", "Você pode só ver este diário. Peça para o administrador mudar seu papel se quiser editar.");
}
export function requireAdmin(dog: CurrentDog) {
  if (dog.role !== "admin") throw new HttpError(403, "ADMIN_ONLY", "Só o administrador do diário pode fazer isso.");
}

/** Nome para mostrar ("guardada por Bianca"): perfil, metadados do login ou o começo do email. */
export function nameFromUser(u: { email?: string | null; user_metadata?: any } | null | undefined) {
  const meta = u?.user_metadata ?? {};
  const n = (meta.full_name || meta.name || meta.given_name || "").toString().trim();
  if (n) return n.split(/\s+/)[0].slice(0, 30);
  const local = (u?.email ?? "").split("@")[0].replace(/[._\-+0-9]+/g, " ").trim();
  return local ? local[0].toUpperCase() + local.slice(1).split(" ")[0].slice(0, 29) : "Alguém da família";
}

/** Lista de diários da pessoa (para o seletor) e membros do diário aberto. */
export async function familyInfo(ctx: Ctx, dog: CurrentDog | null) {
  const admin = adminClient();
  const { data: mine } = await admin.from("dog_members").select("dog_id, role, dogs!inner(id, name, photo_asset_id, avatar_crop)").eq("user_id", ctx.user.id).order("created_at");
  const diaries = ((mine ?? []) as any[]).map((r) => ({ id: r.dogs.id, name: r.dogs.name, photoMediaId: r.dogs.photo_asset_id ?? null, avatarCrop: r.dogs.avatar_crop ?? null, role: r.role as Role }));
  let members: { userId: string; name: string; email: string; role: Role; me: boolean; owner: boolean }[] = [];
  if (dog) {
    const { data: mem } = await admin.from("dog_members").select("user_id, role, created_at").eq("dog_id", dog.id).order("created_at");
    const { data: profs } = await admin.from("profiles").select("user_id, display_name").in("user_id", ((mem ?? []) as any[]).map((m) => m.user_id));
    const pname = new Map(((profs ?? []) as any[]).map((p) => [p.user_id, p.display_name as string]));
    members = await Promise.all(((mem ?? []) as any[]).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return { userId: m.user_id, name: pname.get(m.user_id) || nameFromUser(data.user), email: data.user?.email ?? "", role: m.role as Role, me: m.user_id === ctx.user.id, owner: m.user_id === dog.owner_id };
    }));
  }
  return { diaries, members };
}

export async function switchDog(ctx: Ctx, args: unknown) {
  const { dogId } = z.object({ dogId: z.string().uuid() }).parse(args);
  const admin = adminClient();
  const { data } = await admin.from("dog_members").select("dog_id").eq("dog_id", dogId).eq("user_id", ctx.user.id).maybeSingle();
  if (!data) throw bad("NOT_FOUND", "Diário não encontrado.");
  await admin.from("profiles").update({ current_dog_id: dogId }).eq("user_id", ctx.user.id);
  forgetDog(ctx);
  return {};
}

// ---------- Convites ----------
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const normalizeInvite = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^PATA/, "");
const hashInvite = (c: string) => createHash("sha256").update(`ddp-invite:${normalizeInvite(c)}`).digest("hex");
export const INVITE_DAYS = 7;

export async function createInvite(ctx: Ctx, args: unknown) {
  const { role } = z.object({ role: z.enum(["editor", "viewer"]) }).parse(args);
  const dog = (await currentDog(ctx))!;
  requireAdmin(dog);
  const raw = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const code = `PATA-${raw.slice(0, 4)}-${raw.slice(4)}`;
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();
  const { error } = await adminClient().from("dog_invites").insert({ dog_id: dog.id, role, code_hash: hashInvite(code), created_by: ctx.user.id, expires_at: expiresAt });
  if (error) throw new HttpError(500, "SERVER", "Não conseguimos criar o convite agora.");
  return { code, role, expiresAt, dogName: dog.name };
}

// Limite simples de tentativas por IP (por instância): evita adivinhar códigos.
const tries = new Map<string, { n: number; until: number }>();
export function inviteRateLimited(ip: string) {
  const now = Date.now(), t = tries.get(ip);
  if (!t || t.until < now) { tries.set(ip, { n: 1, until: now + 10 * 60_000 }); return false; }
  return ++t.n > 15;
}

async function findInvite(code: string) {
  const norm = normalizeInvite(code);
  if (norm.length !== 8) throw bad("INVALID_CODE", "Confira o código.");
  const { data } = await adminClient().from("dog_invites").select("*").eq("code_hash", hashInvite(norm)).maybeSingle();
  const inv = data as any;
  if (!inv || inv.used_at || Date.parse(inv.expires_at) < Date.now()) throw bad("INVALID_CODE", "Convite inválido, vencido ou já usado. Peça um novo para quem convidou.");
  return inv;
}

/** Prévia pública do convite (antes de entrar): nome do cachorro, quem convidou e o papel. */
export async function previewInvite(code: string) {
  const inv = await findInvite(code);
  const admin = adminClient();
  const [{ data: dog }, { data: by }, { data: prof }] = await Promise.all([
    admin.from("dogs").select("name").eq("id", inv.dog_id).maybeSingle(),
    admin.auth.admin.getUserById(inv.created_by),
    admin.from("profiles").select("display_name").eq("user_id", inv.created_by).maybeSingle(),
  ]);
  return { dogName: (dog as any)?.name ?? "o cachorro", invitedBy: (prof as any)?.display_name || nameFromUser(by.user), role: inv.role as Role };
}

export async function acceptInvite(ctx: Ctx, args: unknown) {
  const { code, name } = z.object({ code: z.string(), name: z.string().optional() }).parse(args);
  const inv = await findInvite(code);
  const admin = adminClient();
  const { data: already } = await admin.from("dog_members").select("role").eq("dog_id", inv.dog_id).eq("user_id", ctx.user.id).maybeSingle();
  const used = await admin.from("dog_invites").update({ used_at: new Date().toISOString(), used_by: ctx.user.id }).eq("id", inv.id).is("used_at", null).select("id");
  if (!used.data?.length) throw bad("INVALID_CODE", "Esse convite já foi usado.");
  if (!already) await admin.from("dog_members").insert({ dog_id: inv.dog_id, user_id: ctx.user.id, role: inv.role, invited_by: inv.created_by });
  const display = name?.replace(/\s+/g, " ").trim().slice(0, 40);
  await admin.from("profiles").upsert({ user_id: ctx.user.id, current_dog_id: inv.dog_id, ...(display ? { display_name: display, name_confirmed: true } : {}) }, { onConflict: "user_id" });
  forgetDog(ctx);
  return { dogId: inv.dog_id };
}

export async function updateMember(ctx: Ctx, args: unknown) {
  const a = z.object({ userId: z.string().uuid(), role: z.enum(["admin", "editor", "viewer"]) }).parse(args);
  const dog = (await currentDog(ctx))!;
  requireAdmin(dog);
  const admin = adminClient();
  if (a.userId === ctx.user.id && a.role !== "admin") {
    const { count } = await admin.from("dog_members").select("user_id", { count: "exact", head: true }).eq("dog_id", dog.id).eq("role", "admin");
    if ((count ?? 0) <= 1) throw bad("LAST_ADMIN", "O diário precisa de pelo menos um administrador.");
  }
  await admin.from("dog_members").update({ role: a.role }).eq("dog_id", dog.id).eq("user_id", a.userId);
  return {};
}

export async function removeMember(ctx: Ctx, args: unknown) {
  const a = z.object({ userId: z.string().uuid() }).parse(args);
  const dog = (await currentDog(ctx))!;
  const admin = adminClient();
  const self = a.userId === ctx.user.id;
  if (!self) requireAdmin(dog);
  if (a.userId === dog.owner_id) throw bad("OWNER", "Quem criou o diário não pode ser removido. Para encerrar, exclua o diário.");
  if (self && dog.role === "admin") {
    const { count } = await admin.from("dog_members").select("user_id", { count: "exact", head: true }).eq("dog_id", dog.id).eq("role", "admin");
    if ((count ?? 0) <= 1) throw bad("LAST_ADMIN", "Você é o único administrador. Passe o papel para alguém antes de sair.");
  }
  await admin.from("dog_members").delete().eq("dog_id", dog.id).eq("user_id", a.userId);
  if (self) {
    await admin.from("profiles").update({ current_dog_id: null }).eq("user_id", ctx.user.id);
    forgetDog(ctx);
  }
  return {};
}
