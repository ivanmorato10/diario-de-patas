/** Limpeza programada (Vercel Cron): uploads abandonados e arquivos de lembranças/contas excluídas. */
import { NextResponse } from "next/server";
import { configMissing } from "@/server/config-check";
import { processCleanup } from "@/server/rpc";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const missing = configMissing();
  if (missing) return missing;
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await processCleanup());
}
