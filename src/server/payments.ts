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

const MP_API = "https://api.mercadopago.com/v1";
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

async function mp(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  const res = await fetch(`${MP_API}/${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      ...(init.idempotencyKey ? { "x-idempotency-key": init.idempotencyKey } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("mercadopago", res.status, JSON.stringify(json)?.slice(0, 300));
    throw new HttpError(502, "PAYMENT_PROVIDER", "Não conseguimos gerar o Pix agora. Tente de novo em instantes.");
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
  if (status === "refunded" && p.status === "approved") {
    const { data: taken } = await admin.rpc("revoke_purchase_credits", { p_purchase: p.id });
    console.warn("estorno de compra", p.id, "créditos retirados:", taken, "de", p.credits);
  }
  return status;
}

/** Rotina: reconsulta Pix pendentes/vencidos dos últimos 3 dias (aprovação que chegou depois do prazo). */
export async function reconcileRecentPurchases() {
  if (!process.env.MP_ACCESS_TOKEN) return { checked: 0 };
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const rows = ((await adminClient().from("credit_purchases").select("id, status").eq("provider", "mercadopago").in("status", ["pending", "expired"]).gte("created_at", since).limit(200)).data ?? []) as any[];
  let changed = 0;
  for (const r of rows) {
    const before = r.status;
    const after = await syncPurchase(r.id).catch(() => before);
    if (after !== before) changed++;
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
  if (prior) return toPurchase(prior); // duplo toque: o mesmo Pix
  const pending = (await admin.from("credit_purchases").select("id").eq("owner_id", ctx.user.id).eq("status", "pending").gte("created_at", new Date(Date.now() - 3600_000).toISOString())).data ?? [];
  if (pending.length >= 5) throw bad("TOO_MANY", "Você tem vários Pix em aberto. Pague um deles ou espere vencer.");
  const row = (await admin.from("credit_purchases").insert({
    owner_id: ctx.user.id, dog_id: dog.id, package_id: pkg.id, credits: pkg.credits, amount_cents: pkg.priceCents, currency: "BRL",
    provider: paymentsFake() ? "teste" : "mercadopago", idempotency_key: `${ctx.user.id}:${a.data.idempotencyKey}`,
  }).select("*").single()).data as any;
  try {
    const pix = await createPix(row.id, pkg.priceCents, `Diário de Patas — ${pkg.credits} créditos (${dog.name})`, ctx.user.email ?? "");
    const upd = (await admin.from("credit_purchases").update({
      provider_payment_id: pix.providerPaymentId, status: pix.status, pix_qr: pix.qr, pix_qr_base64: pix.qrBase64, expires_at: pix.expiresAt, updated_at: now(),
    }).eq("id", row.id).select("*").single()).data;
    return toPurchase(upd);
  } catch (e) {
    await admin.from("credit_purchases").update({ status: "cancelled", updated_at: now() }).eq("id", row.id);
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
