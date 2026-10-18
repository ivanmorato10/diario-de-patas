/**
 * Compra de créditos com Pix (Mercado Pago). Regras:
 * - O preço e os créditos vêm SEMPRE do servidor (src/config/credits.ts), nunca do navegador.
 * - O status vem SEMPRE da API do Mercado Pago (webhook só avisa; a consulta confirma).
 * - Créditos são concedidos uma única vez por compra (grant_purchase_credits é idempotente).
 * - Desligado sem PAYMENTS_ENABLED=true. PAYMENTS_FAKE=1 (só local, nunca na Vercel) simula o Pix para testes.
 */
import { currentDog, requireEditor } from "./family";
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { CREDIT_PACKAGES, PIX_EXPIRES_MINUTES, packageById } from "@/config/credits";
import { adminClient, HttpError } from "./supabase";

type Ctx = { supa: SupabaseClient; user: User };
type Status = "pending" | "approved" | "rejected" | "expired" | "cancelled" | "refunded";

/** Só em teste local (nunca na Vercel): MP_API_BASE aponta para um Mercado Pago simulado (scripts/e2e-pix.py). */
const MP_API = (!process.env.VERCEL && process.env.MP_API_BASE) || "https://api.mercadopago.com/v1";
const bad = (code: string, message: string) => new HttpError(400, code, message);
const now = () => new Date().toISOString();

export const paymentsFake = () => process.env.PAYMENTS_FAKE === "1" && !process.env.VERCEL;
export const paymentsEnabled = () => process.env.PAYMENTS_ENABLED === "true" && (!!process.env.MP_ACCESS_TOKEN || paymentsFake());

interface PixCharge { providerPaymentId: string; status: Status; qr: string | null; qrBase64: string | null; expiresAt: string }

/** Status do Mercado Pago → nosso status. */
export function mapMpStatus(s: string | undefined): Status {
  switch (s) {
    case "approved": return "approved";
    case "rejected": return "rejected";
    case "cancelled": return "cancelled";
    case "refunded": case "charged_back": return "refunded";
    default: return "pending"; // pending, in_process, authorized
  }
}

/**
 * Falha do Mercado Pago. `certain`: ele RESPONDEU recusando (4xx) — dá para afirmar que não houve cobrança.
 * Sem resposta, tempo esgotado ou erro do lado dele (5xx): INCERTO — a cobrança pode ter sido criada.
 */
class MpError extends HttpError {
  constructor(readonly certain: boolean) {
    super(502, "PAYMENT_PROVIDER", certain ? "O Mercado Pago recusou o Pix. Tente de novo em instantes." : "Não conseguimos confirmar o Pix agora. Tente de novo em instantes.");
  }
}

async function mp(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  let res: Response;
  try {
    res = await fetch(`${MP_API}/${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      ...(init.idempotencyKey ? { "x-idempotency-key": init.idempotencyKey } : {}),
    },
    signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new MpError(false); // rede/tempo esgotado: incerto
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("mercadopago", res.status, JSON.stringify(json)?.slice(0, 300));
    throw new MpError(res.status >= 400 && res.status < 500);
  }
  return json as any;
}

async function createPix(purchaseId: string, amountCents: number, description: string, email: string): Promise<PixCharge> {
  const expiresAt = new Date(Date.now() + PIX_EXPIRES_MINUTES * 60_000).toISOString();
  if (paymentsFake()) return { providerPaymentId: `teste-${purchaseId}`, status: "pending", qr: `00020126PIXDETESTE-${purchaseId}`, qrBase64: null, expiresAt };
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://diario-de-patas.vercel.app";
  const json = await mp("payments", {
    method: "POST",
    idempotencyKey: purchaseId,
    body: JSON.stringify({
      transaction_amount: amountCents / 100,
      description,
      payment_method_id: "pix",
      external_reference: purchaseId,
      notification_url: `${site}/api/pagamentos/webhook`,
      date_of_expiration: expiresAt,
      payer: { email },
    }),
  });
  const tx = json?.point_of_interaction?.transaction_data ?? {};
  return { providerPaymentId: String(json.id), status: mapMpStatus(json.status), qr: tx.qr_code ?? null, qrBase64: tx.qr_code_base64 ?? null, expiresAt: json.date_of_expiration ?? expiresAt };
}

/**
 * Consulta a fonte da verdade (Mercado Pago) e aplica na compra.
 * - Também reconsulta compras "expired" (aprovação atrasada) e "approved" (estorno/chargeback depois).
 * - Confere referência, valor e moeda antes de conceder.
 * - Sem resposta do Mercado Pago, o resultado é INCERTO: nada muda (não vira cancelada/vencida).
 * - Créditos: concedidos uma vez (grant_purchase_credits); no estorno, retira só o que sobrou (revoke_purchase_credits).
 */
export async function syncPurchase(purchaseId: string): Promise<Status> {
  const admin = adminClient();
  const p = (await admin.from("credit_purchases").select("*").eq("id", purchaseId).maybeSingle()).data as any;
  if (!p) return "cancelled";
  let status: Status = p.status;
  // Pix cuja resposta se perdeu ao criar: procura pela nossa referência (a mesma compra, nunca outra).
  if (p.provider === "mercadopago" && !p.provider_payment_id && p.status === "pending") {
    try {
      const found = await mp(`payments/search?external_reference=${encodeURIComponent(p.id)}&sort=date_created&criteria=desc`);
      const pay = (found?.results ?? [])[0];
      if (pay) {
        const tx = pay.point_of_interaction?.transaction_data ?? {};
        await admin.from("credit_purchases").update({ provider_payment_id: String(pay.id), pix_qr: tx.qr_code ?? null, pix_qr_base64: tx.qr_code_base64 ?? null, expires_at: pay.date_of_expiration ?? p.expires_at, updated_at: now() }).eq("id", p.id).is("provider_payment_id", null);
        p.provider_payment_id = String(pay.id);
      } else if (Date.parse(p.created_at) < Date.now() - (PIX_EXPIRES_MINUTES + 10) * 60_000) {
        status = "expired"; // o Mercado Pago confirma que não há cobrança e já passou do prazo
      }
    } catch {
      return p.status; // incerto: tenta depois
    }
  }
  if (p.provider === "mercadopago" && p.provider_payment_id && ["pending", "expired", "approved"].includes(p.status)) {
    let json: any;
    try {
      json = await mp(`payments/${encodeURIComponent(p.provider_payment_id)}`);
    } catch {
      return p.status; // incerto: tenta de novo depois (webhook, consulta da tela ou rotina)
    }
    if (String(json.external_reference) !== p.id) throw new HttpError(409, "MISMATCH", "Pagamento não confere.");
    const paidCents = Math.round(Number(json.transaction_amount) * 100);
    if (paidCents !== p.amount_cents || (json.currency_id && json.currency_id !== "BRL")) {
      console.error("pagamento com valor/moeda diferente", p.id, paidCents, json.currency_id);
      throw new HttpError(409, "MISMATCH", "Pagamento não confere.");
    }
    status = mapMpStatus(json.status);
    // Pix ainda pendente e passado do prazo (confirmado pelo provedor): vencido.
    if (status === "pending" && p.expires_at && Date.parse(p.expires_at) < Date.now() - 60_000) status = "expired";
  } else if (p.status === "pending" && p.expires_at && Date.parse(p.expires_at) < Date.now() - 60_000) {
    status = "expired"; // Pix de teste (sem provedor real)
  }
  if (status !== p.status) {
    await admin.from("credit_purchases").update({ status, updated_at: now(), ...(status === "approved" && !p.approved_at ? { approved_at: now() } : {}) }).eq("id", p.id).eq("status", p.status);
  }
  if (status === "approved") await admin.rpc("grant_purchase_credits", { p_purchase: p.id });
  // Estorno: aplica o desconto até conseguir (refund_applied_at). Se falhar, a próxima reconciliação repete.
  if (status === "refunded" && !p.refund_applied_at) {
    const { data: taken, error } = await admin.rpc("revoke_purchase_credits", { p_purchase: p.id });
    if (error) {
      console.error("estorno não aplicado (vai tentar de novo)", p.id, error.message);
      throw new HttpError(500, "SERVER", "Não conseguimos aplicar o estorno agora.");
    }
    console.warn("estorno de compra", p.id, "créditos retirados:", taken, "de", p.credits);
  }
  return status;
}

/** Rotina: reconsulta Pix pendentes/vencidos dos últimos 3 dias e aplica estornos pendentes. */
export async function reconcileRecentPurchases() {
  if (!process.env.MP_ACCESS_TOKEN) return { checked: 0 };
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const admin = adminClient();
  const recent = ((await admin.from("credit_purchases").select("id, status").eq("provider", "mercadopago").in("status", ["pending", "expired"]).gte("created_at", since).limit(200)).data ?? []) as any[];
  // Estornos ainda não aplicados (de qualquer data: chargeback pode chegar semanas depois).
  const refunds = ((await admin.from("credit_purchases").select("id, status").eq("status", "refunded").is("refund_applied_at", null).limit(200)).data ?? []) as any[];
  const rows = [...recent, ...refunds];
  let changed = 0;
  for (const r of rows) {
    const before = r.status;
    const after = await syncPurchase(r.id).catch(() => before);
    if (after !== before || r.status === "refunded") changed++;
  }
  return { checked: rows.length, changed };
}

const toPurchase = (p: any) => ({
  id: p.id as string, packageId: p.package_id as string, credits: p.credits as number, amountCents: p.amount_cents as number,
  status: p.status as Status, pixQr: p.pix_qr as string | null, pixQrBase64: p.pix_qr_base64 as string | null,
  expiresAt: p.expires_at as string | null, createdAt: p.created_at as string, test: p.provider === "teste",
});

// ---------- RPC ----------

export async function creditShop(ctx: Ctx) {
  const dog = (await currentDog(ctx))!;
  const recent = (await ctx.supa.from("credit_purchases").select("*").eq("dog_id", dog.id).order("created_at", { ascending: false }).limit(10)).data ?? [];
  return { enabled: paymentsEnabled(), test: paymentsFake() || (process.env.MP_ACCESS_TOKEN ?? "").startsWith("TEST-"), packages: CREDIT_PACKAGES, purchases: recent.map(toPurchase) };
}

const Create = z.object({ packageId: z.string(), idempotencyKey: z.string().uuid() });

export async function createPurchase(ctx: Ctx, args: unknown) {
  const a = Create.safeParse(args);
  if (!a.success) throw bad("INVALID", "Pedido inválido.");
  if (!paymentsEnabled()) throw bad("PAYMENTS_OFF", "A compra de créditos ainda não está disponível.");
  const pkg = packageById(a.data.packageId);
  if (!pkg) throw bad("INVALID", "Pacote não encontrado.");
  const dog = (await currentDog(ctx))!;
  requireEditor(dog);
  const admin = adminClient();
  const prior = (await admin.from("credit_purchases").select("*").eq("idempotency_key", `${ctx.user.id}:${a.data.idempotencyKey}`).maybeSingle()).data;
  if (prior) {
    // Duplo toque ou nova tentativa: o mesmo Pix. Se a cobrança ficou incerta, tenta anexar de novo
    // (o Mercado Pago devolve a MESMA cobrança para a mesma chave de idempotência).
    if (prior.status === "pending" && !prior.provider_payment_id && prior.provider === "mercadopago") return attachPix(prior, dog.name, ctx.user.email ?? "");
    return toPurchase(prior);
  }
  const pending = (await admin.from("credit_purchases").select("id").eq("owner_id", ctx.user.id).eq("status", "pending").gte("created_at", new Date(Date.now() - 3600_000).toISOString())).data ?? [];
  if (pending.length >= 5) throw bad("TOO_MANY", "Você tem vários Pix em aberto. Pague um deles ou espere vencer.");
  const row = (await admin.from("credit_purchases").insert({
    owner_id: ctx.user.id, dog_id: dog.id, package_id: pkg.id, credits: pkg.credits, amount_cents: pkg.priceCents, currency: "BRL",
    provider: paymentsFake() ? "teste" : "mercadopago", idempotency_key: `${ctx.user.id}:${a.data.idempotencyKey}`,
  }).select("*").single()).data as any;
  return attachPix(row, dog.name, ctx.user.email ?? "");
}

/**
 * Cria (ou recupera) a cobrança Pix da compra. A chave de idempotência é o id da compra: repetir devolve
 * a mesma cobrança. Só uma recusa CLARA do Mercado Pago cancela; resultado incerto deixa pendente (sem
 * QR) para nova tentativa ou para a reconciliação encontrar pela referência.
 */
async function attachPix(row: any, dogName: string, email: string) {
  const admin = adminClient();
  try {
    const pix = await createPix(row.id, row.amount_cents, `Diário de Patas — ${row.credits} créditos (${dogName})`, email);
    const upd = (await admin.from("credit_purchases").update({
      provider_payment_id: pix.providerPaymentId, status: pix.status, pix_qr: pix.qr, pix_qr_base64: pix.qrBase64, expires_at: pix.expiresAt, updated_at: now(),
    }).eq("id", row.id).select("*").single()).data;
    return toPurchase(upd);
  } catch (e) {
    if (e instanceof MpError && e.certain) await admin.from("credit_purchases").update({ status: "cancelled", updated_at: now() }).eq("id", row.id).eq("status", "pending");
    throw e;
  }
}

export async function purchaseStatus(ctx: Ctx, args: unknown) {
  const id = z.object({ id: z.string().uuid() }).parse(args).id;
  const own = (await ctx.supa.from("credit_purchases").select("id").eq("id", id).maybeSingle()).data;
  if (!own) throw new HttpError(404, "NOT_FOUND", "Compra não encontrada.");
  await syncPurchase(id);
  return toPurchase((await ctx.supa.from("credit_purchases").select("*").eq("id", id).single()).data);
}

/** Só no modo de teste local: simula o pagamento aprovado. */
export async function fakePayPurchase(ctx: Ctx, args: unknown) {
  if (!paymentsFake()) throw new HttpError(404, "NOT_FOUND", "Indisponível.");
  const id = z.object({ id: z.string().uuid() }).parse(args).id;
  const own = (await ctx.supa.from("credit_purchases").select("id, status").eq("id", id).maybeSingle()).data as any;
  if (!own) throw new HttpError(404, "NOT_FOUND", "Compra não encontrada.");
  await adminClient().from("credit_purchases").update({ status: "approved", approved_at: now(), updated_at: now() }).eq("id", id).eq("status", "pending");
  await syncPurchase(id);
  return { ok: true };
}

// ---------- Webhook ----------

/** Assinatura do Mercado Pago: x-signature "ts=…,v1=…" sobre "id:<data.id>;request-id:<x-request-id>;ts:<ts>;". */
export function validMpSignature(secret: string, signature: string | null, requestId: string | null, dataId: string | null) {
  if (!signature || !dataId) return false;
  const parts = Object.fromEntries(signature.split(",").map((kv) => kv.trim().split("=", 2) as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};${requestId ? `request-id:${requestId};` : ""}ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function handleMpWebhook(req: Request) {
  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (secret && !validMpSignature(secret, req.headers.get("x-signature"), req.headers.get("x-request-id"), dataId)) return 401;
  if (!dataId || !process.env.MP_ACCESS_TOKEN) return 200;
  // A notificação só diz "olhe o pagamento X": quem decide é a consulta à API.
  const json = await mp(`payments/${encodeURIComponent(dataId)}`).catch(() => null);
  const ref = json?.external_reference;
  if (!ref || !/^[0-9a-f-]{36}$/.test(ref)) return 200;
  const admin = adminClient();
  const p = (await admin.from("credit_purchases").select("id, provider_payment_id").eq("id", ref).maybeSingle()).data as any;
  if (!p || p.provider_payment_id !== String(json.id)) return 200;
  await syncPurchase(p.id);
  return 200;
}
