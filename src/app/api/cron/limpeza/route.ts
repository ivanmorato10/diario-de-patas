/** Rotina diária (Vercel Cron): limpeza de arquivos, reconciliação de compras e revogações pendentes do login Apple. */
import { NextResponse } from "next/server";
import { configMissing } from "@/server/config-check";
import { processCleanup } from "@/server/rpc";
import { reconcileRecentPurchases } from "@/server/payments";
import { retryAppleRevocations } from "@/server/apple-signin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const missing = configMissing();
  if (missing) return missing;
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cleanup = await processCleanup();
  const purchases = await reconcileRecentPurchases().catch((e) => ({ error: e instanceof Error ? e.message : "erro" }));
  const appleRevocations = await retryAppleRevocations().catch((e) => ({ error: e instanceof Error ? e.message : "erro" }));
  return NextResponse.json({ cleanup, purchases, appleRevocations });
}
