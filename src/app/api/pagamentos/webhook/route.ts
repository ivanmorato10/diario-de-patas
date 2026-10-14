/** Notificações do Mercado Pago (Pix pago, recusado, estornado). Sempre responde rápido; a API é a fonte da verdade. */
import { NextResponse } from "next/server";
import { handleMpWebhook } from "@/server/payments";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const status = await handleMpWebhook(req).catch((e) => {
    console.error("webhook mercadopago", e instanceof Error ? e.message : e);
    return 500; // o Mercado Pago tenta de novo
  });
  return new NextResponse(null, { status });
}
