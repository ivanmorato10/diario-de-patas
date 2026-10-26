/**
 * Entrar com Apple: guardar o token da Apple no login e REVOGAR a autorização na Apple ao excluir a conta
 * (App Store 5.1.1(v)). O Supabase troca o código com a Apple e devolve o token de atualização uma vez, na volta do
 * login; ele fica cifrado (AES-256-GCM, chave derivada do segredo do servidor) e só o servidor lê.
 * Precisa de APPLE_SERVICES_ID e APPLE_SECRET (o mesmo "Secret Key" do Supabase, `npm run apple:secret`) no servidor.
 * Contas antigas sem token guardado: a exclusão segue e a tela explica como remover em Ajustes do iPhone.
 */
import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { adminClient } from "./supabase";

const key = () => {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("sem segredo do servidor");
  return Buffer.from(hkdfSync("sha256", secret, "diario-de-patas", "apple-signin-token", 32));
};

export function seal(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function unseal(box: string): string {
  const [v, iv, tag, body] = box.split(".");
  if (v !== "v1" || !iv || !tag || !body) throw new Error("formato");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}

/** Na volta do login com a Apple: guarda (ou troca) o token de atualização. Falha não impede o login. */
export async function saveAppleToken(userId: string, refreshToken: string) {
  const { error } = await adminClient().from("apple_signin_tokens").upsert({ user_id: userId, refresh_token_sealed: seal(refreshToken), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) console.error("login Apple: token não guardado", error.message);
}

export type AppleRevoke = "revoked" | "no-token" | "not-configured" | "failed";

/** Uma chamada à Apple para revogar o token (já decifrado). */
async function revokeToken(token: string, fetcher: typeof fetch): Promise<{ ok: boolean; error?: string }> {
  const clientId = process.env.APPLE_SERVICES_ID, secret = process.env.APPLE_SECRET;
  if (!clientId || !secret) return { ok: false, error: "not-configured" };
  try {
    const res = await fetcher("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: secret, token, token_type_hint: "refresh_token" }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok ? { ok: true } : { ok: false, error: `http ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "erro" };
  }
}

/**
 * Revoga na Apple a autorização desta conta (antes de apagá-la). Nunca impede a exclusão: se a Apple não responder
 * (ou faltar configuração), o token cifrado vai para a fila apple_revocations, SEM ligação com a conta, e a rotina
 * diária tenta de novo (retryAppleRevocations).
 */
export async function revokeAppleSignIn(userId: string, fetcher: typeof fetch = fetch): Promise<AppleRevoke> {
  const admin = adminClient();
  const { data, error } = await admin.from("apple_signin_tokens").select("refresh_token_sealed").eq("user_id", userId).maybeSingle();
  if (error) { console.error("login Apple: token não lido", error.message); return "failed"; }
  if (!data) return "no-token";
  const sealed = (data as { refresh_token_sealed: string }).refresh_token_sealed;
  let token: string;
  try { token = unseal(sealed); } catch { console.error("login Apple: token ilegível; revogação impossível"); return "failed"; }
  const r = await revokeToken(token, fetcher);
  if (r.ok) return "revoked";
  console.error("login Apple: revogação não feita agora (fica para a rotina)", r.error);
  const { error: queueError } = await admin.from("apple_revocations").insert({ refresh_token_sealed: sealed, attempts: 1, last_error: r.error ?? null, next_try_at: new Date(Date.now() + 3600_000).toISOString() });
  if (queueError) console.error("login Apple: revogação pendente não guardada", queueError.message);
  return r.error === "not-configured" ? "not-configured" : "failed";
}

const GIVE_UP_DAYS = 30;

/** Rotina diária: tenta de novo as revogações pendentes; revogou (ou passou de 30 dias), apaga o token da fila. */
export async function retryAppleRevocations(fetcher: typeof fetch = fetch, limit = 50) {
  const admin = adminClient();
  const { data, error } = await admin.from("apple_revocations").select("*").lte("next_try_at", new Date().toISOString()).order("created_at").limit(limit);
  if (error) throw new Error(`apple_revocations: ${error.message}`);
  let revoked = 0, pending = 0, expired = 0;
  for (const row of (data ?? []) as any[]) {
    let r: { ok: boolean; error?: string };
    try { r = await revokeToken(unseal(row.refresh_token_sealed), fetcher); } catch { r = { ok: false, error: "ilegível" }; }
    const old = Date.parse(row.created_at) < Date.now() - GIVE_UP_DAYS * 86_400_000;
    if (r.ok || old || r.error === "ilegível") {
      if (!r.ok) { expired++; console.error("login Apple: revogação desistida após 30 dias", row.id, r.error); } else revoked++;
      const { error: delError } = await admin.from("apple_revocations").delete().eq("id", row.id);
      if (delError) console.error("login Apple: fila não limpa (repete)", delError.message);
      continue;
    }
    pending++;
    const attempts = (row.attempts ?? 0) + 1;
    const wait = Math.min(24, 2 ** Math.min(attempts, 5)) * 3600_000; // 2 h, 4 h, … até 1 dia
    await admin.from("apple_revocations").update({ attempts, last_error: r.error ?? null, next_try_at: new Date(Date.now() + wait).toISOString() }).eq("id", row.id);
  }
  return { revoked, pending, expired };
}
