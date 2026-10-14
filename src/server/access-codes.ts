/**
 * Código de convite (compartilhar o diário). O dono gera um código curto (30 min, uso único); quem recebe
 * digita na tela de entrada e entra na MESMA conta (mesmo diário, cuidados e créditos). O dono pode
 * desconectar os outros aparelhos a qualquer momento.
 */
import "server-only";
import { createHash, randomInt } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { adminClient, HttpError } from "./supabase";

type Ctx = { supa: SupabaseClient; user: User };
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I/L
export const CODE_MINUTES = 30;

export const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^PATA/, "");
const hashCode = (c: string) => createHash("sha256").update(`ddp-code:${normalizeCode(c)}`).digest("hex");

export async function createAccessCode(ctx: Ctx) {
  const admin = adminClient();
  const raw = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const code = `PATA-${raw.slice(0, 4)}-${raw.slice(4)}`;
  // Um código válido por vez: os anteriores ainda não usados deixam de valer.
  await admin.from("access_codes").update({ expires_at: new Date().toISOString() }).eq("owner_id", ctx.user.id).is("used_at", null);
  const expiresAt = new Date(Date.now() + CODE_MINUTES * 60_000).toISOString();
  const { error } = await admin.from("access_codes").insert({ owner_id: ctx.user.id, code_hash: hashCode(code), expires_at: expiresAt });
  if (error) throw new HttpError(500, "SERVER", "Não conseguimos gerar o código agora.");
  return { code, expiresAt };
}

// Limite simples de tentativas por IP (em memória da instância): evita adivinhação.
const tries = new Map<string, { n: number; until: number }>();
function limited(ip: string) {
  const now = Date.now(), t = tries.get(ip);
  if (!t || t.until < now) { tries.set(ip, { n: 1, until: now + 10 * 60_000 }); return false; }
  t.n++;
  return t.n > 10;
}

/** Troca um código válido por um token de entrada (magic link gerado no servidor, sem email). */
export async function redeemAccessCode(code: string, ip: string) {
  if (limited(ip)) throw new HttpError(429, "TOO_MANY", "Muitas tentativas. Espere alguns minutos.");
  const norm = normalizeCode(code);
  if (norm.length !== 8) throw new HttpError(400, "INVALID_CODE", "Confira o código.");
  const admin = adminClient();
  const row = (await admin.from("access_codes").select("*").eq("code_hash", hashCode(norm)).maybeSingle()).data as any;
  if (!row || row.used_at || Date.parse(row.expires_at) < Date.now()) throw new HttpError(400, "INVALID_CODE", "Código inválido ou vencido. Peça um novo para quem compartilhou.");
  const used = await admin.from("access_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id).is("used_at", null).select("id");
  if (!used.data?.length) throw new HttpError(400, "INVALID_CODE", "Esse código já foi usado.");
  const { data: u } = await admin.auth.admin.getUserById(row.owner_id);
  const email = u.user?.email;
  if (!email) throw new HttpError(400, "INVALID_CODE", "Não deu para usar esse código. Peça um novo.");
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new HttpError(500, "SERVER", "Não conseguimos entrar agora. Tente de novo.");
  return { tokenHash: data.properties.hashed_token };
}
