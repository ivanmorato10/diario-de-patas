/** Avisos da Apple (App Store Server Notifications V2): estorno e revogação de compras de créditos no iPhone. */
import { NextResponse } from "next/server";
import { handleAppleNotification } from "@/server/apple";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const status = await handleAppleNotification(req).catch((e) => {
    console.error("aviso da apple", e instanceof Error ? e.message : e);
    return 500; // a Apple tenta de novo
  });
  return new NextResponse(null, { status });
}
