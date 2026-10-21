/** Avisos do Stripe (cartão em dólar, região EUA). Só aceita aviso assinado; a API do Stripe é a fonte da verdade. */
import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/server/payments";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const status = await handleStripeWebhook(req).catch((e) => {
    console.error("webhook stripe", e instanceof Error ? e.message : e);
    return 500; // o Stripe tenta de novo
  });
  return new NextResponse(null, { status });
}
