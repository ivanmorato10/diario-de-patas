/** Limpeza programada (Vercel Cron): uploads abandonados e arquivos de lembranças/contas excluídas. */
import { NextResponse } from "next/server";
import { REAL_MODE } from "@/config/mode";
import { processCleanup } from "@/server/rpc";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!REAL_MODE) return NextResponse.json({ skipped: true });
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await processCleanup());
}
