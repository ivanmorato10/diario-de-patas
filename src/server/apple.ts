/**
 * Compra de créditos pela Apple (app do iPhone na App Store). Regras, as mesmas do Pix e do Stripe:
 * - O app só diz "comprei, transação X"; o servidor busca a transação NA APPLE (App Store Server API) e confere a
 *   assinatura dela com o certificado raiz da Apple antes de entregar qualquer crédito.
 * - Confere app (bundle), produto, pessoa (appAccountToken emitido pelo servidor) e se não foi estornada.
 * - Créditos uma vez por transação (provider_payment_id único + grant_purchase_credits idempotente).
 * - Avisos da Apple (App Store Server Notifications V2): só assinados; estorno/revogação retira os créditos.
 * Desligado sem as chaves (APPLE_IAP_*): o app do iPhone mostra a loja como indisponível.
 */
import "server-only";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AppStoreServerAPIClient, APIException, Environment, SignedDataVerifier, type JWSTransactionDecodedPayload } from "@apple/app-store-server-library";
import { APPLE_PRODUCTS, packageForAppleProduct } from "@/config/credits";
import { APPLE_ROOT_CA_G3 } from "./apple-root-ca";
import { uuidV5 } from "./ids";
import { currentDog, requireEditor } from "./family";
import { adminClient, HttpError } from "./supabase";
import { must } from "./db";
import { grantCredits, sendReceipt, syncPurchase, toPurchase } from "./payments";

type Ctx = { supa: SupabaseClient; user: User };

export const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || "com.diariodepatas.app";
const appAppleId = () => (process.env.APPLE_APP_ID ? Number(process.env.APPLE_APP_ID) : undefined);
export const appleEnabled = () => !!(process.env.APPLE_IAP_KEY_ID && process.env.APPLE_IAP_ISSUER_ID && process.env.APPLE_IAP_PRIVATE_KEY);

/** Identificador da pessoa na Apple (UUID v5 do id da conta): liga a transação a quem comprou, sem expor email. */
const NAMESPACE = "8f0c5b6e-3d2a-4c1b-9e7f-5a6d4c3b2a10";
export const appAccountTokenFor = (userId: string) => uuidV5(userId, NAMESPACE);

const roots = () => [Buffer.from(APPLE_ROOT_CA_G3, "base64")];
const verifier = (env: Environment) => new SignedDataVerifier(roots(), true, env, APPLE_BUNDLE_ID, env === Environment.PRODUCTION ? appAppleId() : undefined);
const apiClient = (env: Environment) => new AppStoreServerAPIClient(
  (process.env.APPLE_IAP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"), process.env.APPLE_IAP_KEY_ID ?? "", process.env.APPLE_IAP_ISSUER_ID ?? "", APPLE_BUNDLE_ID, env,
);

/**
 * Busca e confere a transação na Apple. Primeiro a produção; se a Apple disser que não existe lá, o sandbox
 * (TestFlight). Resposta incerta (rede, 5xx) lança: o app tenta de novo e a transação continua aberta no iPhone.
 */
async function fetchTransaction(transactionId: string): Promise<{ tx: JWSTransactionDecodedPayload; env: Environment }> {
  for (const env of [Environment.PRODUCTION, Environment.SANDBOX]) {
    try {
      const res = await apiClient(env).getTransactionInfo(transactionId);
      if (!res.signedTransactionInfo) throw new HttpError(502, "PAYMENT_PROVIDER", "errors.appleUncertain");
      return { tx: await verifier(env).verifyAndDecodeTransaction(res.signedTransactionInfo), env };
    } catch (e) {
      if (e instanceof APIException && (e.httpStatusCode === 404 || e.httpStatusCode === 400) && env === Environment.PRODUCTION) continue;
      if (e instanceof HttpError) throw e;
      console.error("apple transação", transactionId, e instanceof APIException ? `${e.httpStatusCode} ${e.apiError}` : e instanceof Error ? e.message : e);
      throw new HttpError(502, "PAYMENT_PROVIDER", "errors.appleUncertain");
    }
  }
  throw new HttpError(400, "INVALID", "errors.appleInvalid");
}

/**
 * Confere a transação já verificada (pura, testada): devolve o pacote e o appAccountToken, ou o motivo da recusa.
 * O token é conferido à parte (tentativa de compra da pessoa, ou o token antigo fixo por conta).
 */
export function checkAppleTransaction(tx: JWSTransactionDecodedPayload, expected: { bundleId: string }) {
  if (tx.bundleId !== expected.bundleId) return { error: "bundle" as const };
  if (!tx.appAccountToken) return { error: "account" as const };
  if (tx.revocationDate) return { error: "revoked" as const };
  const pkg = packageForAppleProduct(String(tx.productId));
  if (!pkg) return { error: "product" as const };
  const quantity = Math.max(1, Number(tx.quantity) || 1);
  return { pkg, token: tx.appAccountToken.toLowerCase(), credits: pkg.credits * quantity, amountCents: Math.round(Number(tx.price ?? 0) / 10), currency: String(tx.currency ?? "USD").toUpperCase() };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Diário de destino de uma transação pelo token dela:
 * - token de uma tentativa desta pessoa → o diário escolhido NAQUELA tentativa (nunca o aberto agora);
 * - token antigo fixo da conta (compras feitas antes desta versão) → o diário aberto, como era;
 * - diário apagado ou sem acesso → pendência explícita (a compra não é finalizada na Apple e o suporte resolve).
 */
async function destinationDog(ctx: Ctx, token: string): Promise<string> {
  const admin = adminClient();
  if (token === appAccountTokenFor(ctx.user.id).toLowerCase()) {
    const dog = (await currentDog(ctx))!;
    requireEditor(dog);
    return dog.id;
  }
  if (!UUID.test(token)) throw new HttpError(409, "MISMATCH", "errors.paymentMismatch");
  const attempt = (await must(admin.from("apple_purchase_attempts").select("user_id, dog_id").eq("id", token).maybeSingle(), "errors.generic")) as any;
  if (!attempt || attempt.user_id !== ctx.user.id) throw new HttpError(409, "MISMATCH", "errors.paymentMismatch"); // compra de outra conta
  const member = attempt.dog_id
    ? await must(admin.from("dog_members").select("dog_id").eq("dog_id", attempt.dog_id).eq("user_id", ctx.user.id).maybeSingle(), "errors.generic")
    : null;
  if (!member) {
    console.error("compra da Apple sem diário de destino (pendência)", token);
    throw new HttpError(409, "APPLE_DIARY_GONE", "errors.appleDiaryGone");
  }
  return attempt.dog_id;
}

// ---------- RPC ----------

/**
 * Logo antes de abrir a compra da Apple: cria uma tentativa com id próprio, gravando o diário aberto (quem pode
 * editar). O id vai para a Apple como appAccountToken; a confirmação, mesmo atrasada ou feita em outro aparelho,
 * entrega neste diário. Duas tentativas nunca mexem no destino uma da outra.
 */
export async function appleIntent(ctx: Ctx) {
  const dog = (await currentDog(ctx))!;
  requireEditor(dog);
  const id = crypto.randomUUID();
  await must(adminClient().from("apple_purchase_attempts").insert({ id, user_id: ctx.user.id, dog_id: dog.id }));
  return { appAccountToken: id };
}

/** Produtos da Apple. Não exige poder editar o diário aberto: a recuperação de compras usa também. */
export async function appleStore(_ctx: Ctx) {
  return { enabled: appleEnabled(), products: APPLE_PRODUCTS };
}

/**
 * Único jeito de responder "compra registrada": confere o dono e, se aprovada, garante a entrega dos créditos (idempotente)
 * e o comprovante. Usado na repetição, na corrida entre duas confirmações e na primeira gravação. Se a entrega falhar,
 * lança: o app não finaliza a transação na Apple e tenta de novo na próxima abertura.
 */
async function settleApplePurchase(ctx: Ctx, row: any) {
  if (row.owner_id !== ctx.user.id) throw new HttpError(409, "MISMATCH", "errors.paymentMismatch");
  if (row.status === "approved") {
    await grantCredits(row.id);
    if (!row.receipt_sent_at) await sendReceipt(row.id);
  }
  return toPurchase(await must(adminClient().from("credit_purchases").select("*").eq("id", row.id).single(), "errors.generic"));
}

/** Depois da compra no iPhone: confere na Apple e entrega os créditos ao diário atual (uma vez por transação). */
export async function appleConfirm(ctx: Ctx, args: unknown) {
  if (!appleEnabled()) throw new HttpError(400, "PAYMENTS_OFF", "errors.paymentsOff");
  const { transactionId } = z.object({ transactionId: z.string().regex(/^\d{1,30}$/) }).parse(args);
  const admin = adminClient();
  const prior = (await must(admin.from("credit_purchases").select("*").eq("provider", "apple").eq("provider_payment_id", transactionId).maybeSingle(), "errors.generic")) as any;
  if (prior) return settleApplePurchase(ctx, prior); // repetição, ou o app reabriu antes de finalizar na Apple
  const { tx, env } = await fetchTransaction(transactionId);
  const checked = checkAppleTransaction(tx, { bundleId: APPLE_BUNDLE_ID });
  if ("error" in checked) {
    console.error("compra da Apple recusada", transactionId, checked.error);
    throw new HttpError(409, "MISMATCH", "errors.paymentMismatch");
  }
  const dogId = await destinationDog(ctx, checked.token);
  const now = new Date().toISOString();
  const { data: row, error } = await admin.from("credit_purchases").insert({
    owner_id: ctx.user.id, dog_id: dogId, package_id: checked.pkg.id, credits: checked.credits, amount_cents: checked.amountCents, currency: checked.currency,
    provider: "apple", provider_payment_id: transactionId, idempotency_key: `apple:${transactionId}`, status: "approved", approved_at: now, updated_at: now,
    sandbox: env !== Environment.PRODUCTION,
  }).select("*").single();
  if (error) {
    // Duas confirmações ao mesmo tempo: a outra gravou primeiro; vale a dela.
    const again = await must(admin.from("credit_purchases").select("*").eq("provider", "apple").eq("provider_payment_id", transactionId).maybeSingle(), "errors.generic");
    if (again) return settleApplePurchase(ctx, again);
    throw new HttpError(500, "SERVER", "errors.generic");
  }
  return settleApplePurchase(ctx, row);
}

// ---------- Avisos da Apple ----------

/** Ambiente declarado no aviso (ainda sem conferir), só para escolher com qual verificador conferir. */
function claimedEnvironment(signedPayload: string): Environment {
  try {
    const body = JSON.parse(Buffer.from(signedPayload.split(".")[1] ?? "", "base64url").toString("utf8"));
    return body?.data?.environment === Environment.SANDBOX ? Environment.SANDBOX : Environment.PRODUCTION;
  } catch {
    return Environment.PRODUCTION;
  }
}

/** Estorno ou revogação: marca a compra como estornada e retira os créditos que sobraram (uma vez). */
export async function handleAppleNotification(req: Request) {
  if (!appleEnabled()) return 400;
  const body = (await req.json().catch(() => null)) as { signedPayload?: string } | null;
  if (!body?.signedPayload) return 400;
  const env = claimedEnvironment(body.signedPayload);
  let note;
  try {
    note = await verifier(env).verifyAndDecodeNotification(body.signedPayload);
  } catch (e) {
    console.error("aviso da Apple recusado", e instanceof Error ? e.message : e);
    return 400;
  }
  if (note.notificationType !== "REFUND" && note.notificationType !== "REVOKE") return 200; // outros avisos: nada a fazer
  if (!note.data?.signedTransactionInfo) return 200;
  const tx = await verifier(env).verifyAndDecodeTransaction(note.data.signedTransactionInfo);
  const admin = adminClient();
  // Estorno: só responde 200 à Apple depois de gravar (se o banco falhar, lança e a Apple manda o aviso de novo).
  const p = (await must(admin.from("credit_purchases").select("id, status").eq("provider", "apple").eq("provider_payment_id", String(tx.transactionId)).maybeSingle(), "errors.generic")) as any;
  if (!p) return 200;
  if (p.status === "approved") await must(admin.from("credit_purchases").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", p.id).eq("status", "approved"));
  await syncPurchase(p.id); // aplica a retirada dos créditos (revoke_purchase_credits), uma vez
  return 200;
}
