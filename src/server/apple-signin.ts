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

/** Revoga na Apple a autorização desta conta (antes de apagá-la). Nunca impede a exclusão: devolve o resultado. */
export async function revokeAppleSignIn(userId: string, fetcher: typeof fetch = fetch): Promise<AppleRevoke> {
  const { data, error } = await adminClient().from("apple_signin_tokens").select("refresh_token_sealed").eq("user_id", userId).maybeSingle();
  if (error) { console.error("login Apple: token não lido", error.message); return "failed"; }
  if (!data) return "no-token";
  const clientId = process.env.APPLE_SERVICES_ID, secret = process.env.APPLE_SECRET;
  if (!clientId || !secret) { console.error("login Apple: APPLE_SERVICES_ID/APPLE_SECRET ausentes no servidor; revogação não feita"); return "not-configured"; }
  let token: string;
  try { token = unseal((data as { refresh_token_sealed: string }).refresh_token_sealed); } catch { return "failed"; }
  try {
    const res = await fetcher("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: secret, token, token_type_hint: "refresh_token" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return "revoked";
    console.error("login Apple: revogação recusada", res.status);
    return "failed";
  } catch (e) {
    console.error("login Apple: revogação sem resposta", e instanceof Error ? e.message : e);
    return "failed";
  }
}
