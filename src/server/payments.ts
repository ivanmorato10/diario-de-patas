/**
 * Compra de créditos: Pix (Mercado Pago, região Brasil) e cartão em dólar (Stripe Checkout, região EUA). Regras:
 * - O preço e os créditos vêm SEMPRE do servidor (src/config/credits.ts), nunca do navegador.
 * - O status vem SEMPRE da API do provedor (webhook só avisa; a consulta confirma valor, moeda e referência).
 * - Créditos são concedidos uma única vez por compra (grant_purchase_credits é idempotente).
 * - Pix desligado sem PAYMENTS_ENABLED=true; Stripe desligado sem STRIPE_ENABLED=true (loja dos EUA "em breve").
 *   PAYMENTS_FAKE=1 (só local, nunca na Vercel) simula o pagamento para testes.
 */
import { currentDog, requireEditor } from "./family";
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { CHECKOUT_EXPIRES_MINUTES, CREDIT_MARKETS, PIX_EXPIRES_MINUTES, marketForRegion, packageById } from "@/config/credits";
import { formatInstant, formatMoney } from "@/i18n/format";
import { adminClient, HttpError } from "./supabase";
import { sendPurchaseConfirmed } from "./mailer";
import { localeOf, regionOf, requestLocale, translator } from "./i18n";

type Ctx = { supa: SupabaseClient; user: User };
type Status = "pending" | "approved" | "rejected" | "expired" | "cancelled" | "refunded";

/** Só em teste local (nunca na Vercel): MP_API_BASE aponta para um Mercado Pago simulado (scripts/e2e-pix.py). */
const MP_API = (!process.env.VERCEL && process.env.MP_API_BASE) || "https://api.mercadopago.com/v1";
const bad = (code: string, message: string, params?: Record<string, string | number>) => new HttpError(400, code, message, params);
const now = () => new Date().toISOString();

export const paymentsFake = () => process.env.PAYMENTS_FAKE === "1" && !process.env.VERCEL;
export const paymentsEnabled = () => process.env.PAYMENTS_ENABLED === "true" && (!!process.env.MP_ACCESS_TOKEN || paymentsFake());
export const stripeEnabled = () => process.env.STRIPE_ENABLED === "true" && (!!process.env.STRIPE_SECRET_KEY || paymentsFake());
const stripeTest = () => (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
/** O provedor do mercado está ligado? (Mercado sem provedor = loja "em breve".) */
const providerEnabled = (provider: string | null) => (provider === "mercadopago" ? paymentsEnabled() : provider === "stripe" ? stripeEnabled() : false);

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
    super(502, "PAYMENT_PROVIDER", certain ? "errors.pixRefused" : "errors.pixUncertain");
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

// ---------- Stripe (região EUA) ----------

/** Falha do Stripe, com a mesma regra do Mercado Pago: `certain` = ele respondeu recusando (não houve cobrança). */
class StripeError extends HttpError {
  constructor(readonly certain: boolean) {
    super(502, "PAYMENT_PROVIDER", certain ? "errors.checkoutRefused" : "errors.checkoutUncertain");
  }
}

/** API REST do Stripe (formulário na ida, JSON na volta). A chave secreta só existe no servidor. */
async function stripe(path: string, init: { method?: "GET" | "POST"; form?: Record<string, string>; idempotencyKey?: string } = {}) {
  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        ...(init.form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        ...(init.idempotencyKey ? { "idempotency-key": init.idempotencyKey } : {}),
      },
      body: init.form ? new URLSearchParams(init.form).toString() : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new StripeError(false);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("stripe", res.status, json?.error?.type, json?.error?.code, String(json?.error?.message ?? "").slice(0, 200));
    throw new StripeError(res.status >= 400 && res.status < 500 && res.status !== 409 && res.status !== 429);
  }
  return json as any;
}

/** Endereço do app para a volta do pagamento (o mesmo de onde a pessoa saiu). */
async function siteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL || "https://diario-de-patas.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

interface CheckoutCharge { providerPaymentId: string; url: string; expiresAt: string }

/**
 * Parâmetros da cobrança gravados na compra ANTES da primeira chamada ao provedor. Uma repetição (resposta perdida,
 * duplo toque) manda exatamente os mesmos, com a mesma chave de idempotência: o provedor devolve a MESMA cobrança.
 * (Recalcular o vencimento a cada tentativa fazia o Stripe recusar a repetição.)
 */
async function frozenRequest<T>(row: any, build: () => Promise<T>, uncertainKey: string): Promise<T> {
  if (row.provider_request) return row.provider_request as T;
  const req = await build();
  const admin = adminClient();
  // Só chama o provedor com os parâmetros que ESTÃO gravados (lidos de volta): se o banco falhar, nada é enviado e a
  // pessoa pode tentar de novo (sem isso, duas tentativas podiam mandar vencimentos diferentes com a mesma chave).
  const upd = await admin.from("credit_purchases").update({ provider_request: req }).eq("id", row.id).is("provider_request", null);
  const saved = await admin.from("credit_purchases").select("provider_request").eq("id", row.id).single();
  if (upd.error || saved.error || !(saved.data as any)?.provider_request) {
    console.error("parâmetros da cobrança não gravados", row.id, upd.error?.message ?? saved.error?.message ?? "vazio");
    throw new HttpError(503, "PAYMENT_PROVIDER", uncertainKey);
  }
  row.provider_request = (saved.data as any).provider_request; // duas tentativas ao mesmo tempo: vale a que gravou primeiro
  return row.provider_request as T;
}

/** Cria a página de pagamento do Stripe para a compra (repetir com o mesmo id devolve a mesma página). */
async function createCheckout(row: any, description: string, email: string): Promise<CheckoutCharge> {
  const form = await frozenRequest<Record<string, string>>(row, async () => {
    const expiresAt = new Date(Date.now() + CHECKOUT_EXPIRES_MINUTES * 60_000);
    const back = `${await siteUrl()}/estudio/creditos?compra=${row.id}`;
    const locale = await requestLocale();
    return {
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": String(row.currency).toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(row.amount_cents),
      "line_items[0][price_data][product_data][name]": description,
      client_reference_id: row.id,
      "metadata[purchase_id]": row.id,
      "payment_intent_data[metadata][purchase_id]": row.id,
      "payment_intent_data[description]": description,
      ...(email ? { customer_email: email } : {}),
      locale: locale === "en" ? "en" : "pt-BR",
      expires_at: String(Math.floor(expiresAt.getTime() / 1000)),
      success_url: `${back}&pagamento=ok`,
      cancel_url: `${back}&pagamento=cancelado`,
    };
  }, "errors.checkoutUncertain");
  const session = await stripe("checkout/sessions", { method: "POST", idempotencyKey: `checkout-${row.id}`, form });
  return { providerPaymentId: String(session.id), url: String(session.url), expiresAt: new Date(Number(form.expires_at) * 1000).toISOString() };
}

/** Sessão do Stripe → nosso status. Pago e depois estornado ou contestado = estornado. */
export function mapStripeSession(s: { status?: string; payment_status?: string; payment_intent?: any }): Status {
  if (s.payment_status === "paid") {
    const charge = s.payment_intent && typeof s.payment_intent === "object" ? s.payment_intent.latest_charge : null;
    if (charge && typeof charge === "object" && (charge.amount_refunded > 0 || charge.refunded || charge.disputed)) return "refunded";
    return "approved";
  }
  if (s.status === "expired") return "expired";
  return "pending";
}

/** Assinatura do Stripe: cabeçalho "t=…,v1=…" sobre "<t>.<corpo>", HMAC-SHA256; recusa avisos com mais de 5 min. */
export function validStripeSignature(secret: string, header: string | null, body: string, nowSec = Math.floor(Date.now() / 1000)) {
  if (!header) return false;
  const items = header.split(",").map((kv) => kv.trim().split("=", 2) as [string, string]);
  const t = items.find(([k]) => k === "t")?.[1];
  const sigs = items.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length || !/^\d+$/.test(t) || Math.abs(nowSec - Number(t)) > 300) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex"));
  return sigs.some((v) => { const b = Buffer.from(v); return b.length === expected.length && timingSafeEqual(b, expected); });
}

async function createPix(row: any, description: string, email: string): Promise<PixCharge> {
  const purchaseId = row.id as string;
  const body = await frozenRequest(row, async () => ({
    transaction_amount: row.amount_cents / 100,
    description,
    payment_method_id: "pix",
    external_reference: purchaseId,
    notification_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://diario-de-patas.vercel.app"}/api/pagamentos/webhook`,
    date_of_expiration: new Date(Date.now() + PIX_EXPIRES_MINUTES * 60_000).toISOString(),
    payer: { email },
  }), "errors.pixUncertain");
  const expiresAt = body.date_of_expiration;
  if (paymentsFake()) return { providerPaymentId: `teste-${purchaseId}`, status: "pending", qr: `00020126PIXDETESTE-${purchaseId}`, qrBase64: null, expiresAt };
  const json = await mp("payments", { method: "POST", idempotencyKey: purchaseId, body: JSON.stringify(body) });
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
    if (String(json.external_reference) !== p.id) throw new HttpError(409, "MISMATCH", "errors.paymentMismatch");
    const paidCents = Math.round(Number(json.transaction_amount) * 100);
    if (paidCents !== p.amount_cents || (json.currency_id && json.currency_id !== (p.currency || "BRL"))) {
      console.error("pagamento com valor/moeda diferente", p.id, paidCents, json.currency_id);
      throw new HttpError(409, "MISMATCH", "errors.paymentMismatch");
    }
    status = mapMpStatus(json.status);
    // Pix ainda pendente e passado do prazo (confirmado pelo provedor): vencido.
    if (status === "pending" && p.expires_at && Date.parse(p.expires_at) < Date.now() - 60_000) status = "expired";
  } else if (p.provider === "stripe" && p.provider_payment_id && ["pending", "expired", "approved"].includes(p.status)) {
    let s: any;
    try {
      s = await stripe(`checkout/sessions/${encodeURIComponent(p.provider_payment_id)}?expand[]=payment_intent.latest_charge`);
    } catch {
      return p.status; // incerto: tenta de novo depois
    }
    if (String(s.client_reference_id) !== p.id) throw new HttpError(409, "MISMATCH", "errors.paymentMismatch");
    if (Number(s.amount_total) !== p.amount_cents || String(s.currency).toUpperCase() !== (p.currency || "BRL")) {
      console.error("pagamento com valor/moeda diferente", p.id, s.amount_total, s.currency);
      throw new HttpError(409, "MISMATCH", "errors.paymentMismatch");
    }
    status = mapStripeSession(s);
  } else if (p.provider === "stripe" && !p.provider_payment_id && p.status === "pending") {
    // A página de pagamento não chegou a ser entregue (resposta perdida): sem página, não há como pagar.
    if (Date.parse(p.created_at) < Date.now() - (CHECKOUT_EXPIRES_MINUTES + 10) * 60_000) status = "expired";
  } else if (p.status === "pending" && p.expires_at && Date.parse(p.expires_at) < Date.now() - 60_000) {
    status = "expired"; // Pix de teste (sem provedor real)
  }
  if (status !== p.status) {
    await admin.from("credit_purchases").update({ status, updated_at: now(), ...(status === "approved" && !p.approved_at ? { approved_at: now() } : {}) }).eq("id", p.id).eq("status", p.status);
  }
  if (status === "approved") {
    await grantCredits(p.id); // falhou? lança: o pagamento fica aprovado e a reconciliação entrega depois
    if (!p.receipt_sent_at) await sendReceipt(p.id);
  }
  // Estorno: aplica o desconto até conseguir (refund_applied_at). Se falhar, a próxima reconciliação repete.
  if (status === "refunded" && !p.refund_applied_at) {
    const { data: taken, error } = await admin.rpc("revoke_purchase_credits", { p_purchase: p.id });
    if (error) {
      console.error("estorno não aplicado (vai tentar de novo)", p.id, error.message);
      throw new HttpError(500, "SERVER", "errors.refundFailed");
    }
    console.warn("estorno de compra", p.id, "créditos retirados:", taken, "de", p.credits);
  }
  return status;
}

/** Entrega os créditos de uma compra aprovada (idempotente). Erro do banco não é engolido. */
export async function grantCredits(purchaseId: string) {
  const { error } = await adminClient().rpc("grant_purchase_credits", { p_purchase: purchaseId });
  if (error) {
    console.error("créditos da compra não entregues (vai tentar de novo)", purchaseId, error.message);
    throw new HttpError(500, "SERVER", "errors.creditsSoon");
  }
}

/**
 * Email "pagamento confirmado": quem reservar a compra primeiro envia (webhook, tela e rotina não duplicam).
 * Reserva com prazo (receipt_claimed_at) ≠ enviado (receipt_sent_at): se o envio falhar, a reserva é desfeita
 * e a rotina tenta de novo.
 */
export async function sendReceipt(purchaseId: string) {
  const admin = adminClient();
  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: claimed } = await admin.from("credit_purchases").update({ receipt_claimed_at: now() })
    .eq("id", purchaseId).is("receipt_sent_at", null).eq("status", "approved")
    .or(`receipt_claimed_at.is.null,receipt_claimed_at.lt.${stale}`).select("*").maybeSingle();
  const p = claimed as any;
  if (!p) return;
  const done = (ok: boolean) => admin.from("credit_purchases").update(ok ? { receipt_sent_at: now() } : { receipt_claimed_at: null }).eq("id", p.id);
  if (!p.owner_id) return void (await done(true)); // quem comprou excluiu a conta: não há para quem enviar
  try {
    const [{ data: u }, { data: dog }, { data: balance }, { data: prof }] = await Promise.all([
      admin.auth.admin.getUserById(p.owner_id),
      admin.from("dogs").select("name").eq("id", p.dog_id).maybeSingle(),
      admin.rpc("credit_available_dog", { p_dog: p.dog_id }),
      admin.from("profiles").select("timezone").eq("user_id", p.owner_id).maybeSingle(),
    ]);
    // Comprovante no idioma de quem comprou; valor na moeda REAL da cobrança; hora no fuso da pessoa.
    const locale = await localeOf(p.owner_id);
    const tz = (prof as any)?.timezone || "America/Sao_Paulo";
    const paidAt = formatInstant(p.approved_at ?? new Date(), locale, tz);
    const result = await sendPurchaseConfirmed(u?.user?.email ?? "", {
      dogName: (dog as any)?.name ?? translator(locale)("emails.yourDog"), credits: p.credits, amount: formatMoney(p.amount_cents, p.currency || "BRL", locale),
      paidAt, balance: typeof balance === "number" ? balance : null, reference: p.id,
    }, locale);
    if (result === "failed") console.warn("comprovante não enviado (vai tentar de novo)", p.id);
    await done(result !== "failed"); // "skipped" = sem SMTP ou endereço de teste: nada a reenviar
  } catch (e) {
    console.error("comprovante não enviado (vai tentar de novo)", p.id, e instanceof Error ? e.message : e);
    await done(false);
  }
}

/** Compras aprovadas sem créditos entregues ou sem comprovante: entrega agora (idempotente). */
async function deliverApproved() {
  const admin = adminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const approved = ((await admin.from("credit_purchases").select("id, receipt_sent_at, approved_at").eq("status", "approved").gte("created_at", since).limit(500)).data ?? []) as any[];
  if (!approved.length) return { granted: 0, receipts: 0 };
  const keys = approved.map((p) => `purchase:${p.id}`);
  const have = new Set((((await admin.from("credit_ledger").select("idempotency_key").in("idempotency_key", keys)).data ?? []) as any[]).map((r) => r.idempotency_key));
  let granted = 0, receipts = 0;
  for (const p of approved) {
    // Comprovante só depois de os créditos estarem entregues: se a entrega falhar, fica pendente (sem email).
    let delivered = have.has(`purchase:${p.id}`);
    if (!delivered) delivered = await grantCredits(p.id).then(() => { granted++; return true; }, () => false);
    if (delivered && !p.receipt_sent_at) { await sendReceipt(p.id); receipts++; }
  }
  return { granted, receipts };
}

export async function reconcileRecentPurchases() {
  const delivered = await deliverApproved().catch((e) => ({ error: e instanceof Error ? e.message : "erro" }));
  const providers = [process.env.MP_ACCESS_TOKEN ? "mercadopago" : null, process.env.STRIPE_SECRET_KEY ? "stripe" : null].filter(Boolean) as string[];
  if (!providers.length) return { checked: 0, delivered };
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const admin = adminClient();
  const recent = ((await admin.from("credit_purchases").select("id, status").in("provider", providers).in("status", ["pending", "expired"]).gte("created_at", since).limit(200)).data ?? []) as any[];
  // Estornos ainda não aplicados (de qualquer data: chargeback pode chegar semanas depois).
  const refunds = ((await admin.from("credit_purchases").select("id, status").eq("status", "refunded").is("refund_applied_at", null).limit(200)).data ?? []) as any[];
  const rows = [...recent, ...refunds];
  let changed = 0;
  for (const r of rows) {
    const before = r.status;
    const after = await syncPurchase(r.id).catch(() => before);
    if (after !== before || r.status === "refunded") changed++;
  }
  return { checked: rows.length, changed, delivered };
}

export const toPurchase = (p: any) => ({
  id: p.id as string, packageId: p.package_id as string, credits: p.credits as number, amountCents: p.amount_cents as number, currency: (p.currency as string) || "BRL",
  status: p.status as Status, pixQr: p.pix_qr as string | null, pixQrBase64: p.pix_qr_base64 as string | null,
  expiresAt: p.expires_at as string | null, createdAt: p.created_at as string,
  test: p.provider === "teste" || (p.provider === "stripe" && stripeTest()) || (p.provider === "apple" && !!p.sandbox),
  provider: p.provider as string, checkoutUrl: p.status === "pending" ? ((p.checkout_url as string | null) ?? null) : null,
});

// ---------- RPC ----------

export async function creditShop(ctx: Ctx) {
  const dog = (await currentDog(ctx))!;
  const recent = (await ctx.supa.from("credit_purchases").select("*").eq("dog_id", dog.id).order("created_at", { ascending: false }).limit(10)).data ?? [];
  const code = await marketOf(ctx);
  const market = CREDIT_MARKETS[code];
  const test = paymentsFake() || (market.provider === "stripe" ? stripeTest() : (process.env.MP_ACCESS_TOKEN ?? "").startsWith("TEST-"));
  return { enabled: providerEnabled(market.provider) && market.packages.length > 0, test, market: code, currency: market.currency, provider: market.provider, packages: market.packages, purchases: recent.map(toPurchase) };
}

/** Mercado da compra pela região do app de quem compra (perfil; sem escolha, a sugestão do idioma). */
async function marketOf(ctx: Ctx) {
  const { data } = await ctx.supa.from("profiles").select("region, locale").eq("user_id", ctx.user.id).maybeSingle();
  return marketForRegion(regionOf(data as { region?: string | null; locale?: string | null } | null));
}

const Create = z.object({ packageId: z.string(), idempotencyKey: z.string().uuid() });

export async function createPurchase(ctx: Ctx, args: unknown) {
  const a = Create.safeParse(args);
  if (!a.success) throw bad("INVALID", "errors.invalidRequest");
  // Valor e moeda vêm do mercado no servidor; o navegador só escolhe o id do pacote.
  const code = await marketOf(ctx);
  const market = CREDIT_MARKETS[code];
  if (!providerEnabled(market.provider)) throw bad("PAYMENTS_OFF", "errors.paymentsOff");
  const pkg = packageById(a.data.packageId, code);
  if (!pkg || !market.provider) throw bad("INVALID", "errors.packageNotFound");
  const dog = (await currentDog(ctx))!;
  requireEditor(dog);
  const admin = adminClient();
  const prior = (await admin.from("credit_purchases").select("*").eq("idempotency_key", `${ctx.user.id}:${a.data.idempotencyKey}`).maybeSingle()).data;
  if (prior) {
    // Duplo toque ou nova tentativa: o mesmo Pix. Se a cobrança ficou incerta, tenta anexar de novo
    // (o Mercado Pago devolve a MESMA cobrança para a mesma chave de idempotência).
    if (prior.status === "pending" && !prior.provider_payment_id && prior.provider === "mercadopago") return attachPix(prior, dog.name, ctx.user.email ?? "");
    if (prior.status === "pending" && !prior.provider_payment_id && prior.provider === "stripe") return attachCheckout(prior, dog.name, ctx.user.email ?? "");
    return toPurchase(prior);
  }
  const pending = (await admin.from("credit_purchases").select("id").eq("owner_id", ctx.user.id).eq("status", "pending").gte("created_at", new Date(Date.now() - 3600_000).toISOString())).data ?? [];
  if (pending.length >= 5) throw bad("TOO_MANY", "errors.tooManyPix");
  const row = (await admin.from("credit_purchases").insert({
    owner_id: ctx.user.id, dog_id: dog.id, package_id: pkg.id, credits: pkg.credits, amount_cents: pkg.priceCents, currency: market.currency,
    provider: paymentsFake() ? "teste" : market.provider, idempotency_key: `${ctx.user.id}:${a.data.idempotencyKey}`,
  }).select("*").single()).data as any;
  return row.provider === "stripe" ? attachCheckout(row, dog.name, ctx.user.email ?? "") : attachPix(row, dog.name, ctx.user.email ?? "");
}

/**
 * Cria (ou recupera) a página de pagamento do Stripe da compra. Mesma regra do Pix: só uma recusa CLARA do
 * Stripe cancela; resultado incerto deixa pendente para nova tentativa (a mesma página, pela chave de idempotência).
 */
async function attachCheckout(row: any, dogName: string, email: string) {
  const admin = adminClient();
  try {
    const c = await createCheckout(row, `Diário de Patas — ${row.credits} credit${row.credits === 1 ? "" : "s"} (${dogName})`, email);
    const upd = (await admin.from("credit_purchases").update({
      provider_payment_id: c.providerPaymentId, checkout_url: c.url, expires_at: c.expiresAt, updated_at: now(),
    }).eq("id", row.id).select("*").single()).data;
    return toPurchase(upd);
  } catch (e) {
    if (e instanceof StripeError && e.certain) await admin.from("credit_purchases").update({ status: "cancelled", updated_at: now() }).eq("id", row.id).eq("status", "pending");
    throw e;
  }
}

/**
 * Cria (ou recupera) a cobrança Pix da compra. A chave de idempotência é o id da compra: repetir devolve
 * a mesma cobrança. Só uma recusa CLARA do Mercado Pago cancela; resultado incerto deixa pendente (sem
 * QR) para nova tentativa ou para a reconciliação encontrar pela referência.
 */
async function attachPix(row: any, dogName: string, email: string) {
  const admin = adminClient();
  try {
    const pix = await createPix(row, `Diário de Patas — ${row.credits} créditos (${dogName})`, email);
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
  if (!own) throw new HttpError(404, "NOT_FOUND", "errors.purchaseNotFound");
  await syncPurchase(id);
  return toPurchase((await ctx.supa.from("credit_purchases").select("*").eq("id", id).single()).data);
}

/** Só no modo de teste local: simula o pagamento aprovado. */
export async function fakePayPurchase(ctx: Ctx, args: unknown) {
  if (!paymentsFake()) throw new HttpError(404, "NOT_FOUND", "errors.unavailable");
  const id = z.object({ id: z.string().uuid() }).parse(args).id;
  const own = (await ctx.supa.from("credit_purchases").select("id, status").eq("id", id).maybeSingle()).data as any;
  if (!own) throw new HttpError(404, "NOT_FOUND", "errors.purchaseNotFound");
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

/**
 * Avisos do Stripe (pagamento concluído, página vencida, estorno, contestação). Só aceita aviso assinado;
 * o aviso só diz "olhe a compra X": quem decide é a consulta à API (syncPurchase).
 */
export async function handleStripeWebhook(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return 400;
  const body = await req.text();
  if (!validStripeSignature(secret, req.headers.get("stripe-signature"), body)) return 400;
  const event = JSON.parse(body) as { type?: string; data?: { object?: any } };
  const obj = event.data?.object ?? {};
  let sessionId: string | null = null;
  if (obj.object === "checkout.session") sessionId = String(obj.id);
  else if ((obj.object === "charge" || obj.object === "dispute") && typeof obj.payment_intent === "string") {
    const list = await stripe(`checkout/sessions?payment_intent=${encodeURIComponent(obj.payment_intent)}&limit=1`);
    sessionId = list?.data?.[0]?.id ?? null;
  }
  if (!sessionId) return 200;
  const p = (await adminClient().from("credit_purchases").select("id").eq("provider", "stripe").eq("provider_payment_id", sessionId).maybeSingle()).data as any;
  if (!p) return 200;
  await syncPurchase(p.id);
  return 200;
}
