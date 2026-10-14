/** Versão publicada (commit). O app compara com a sua e recarrega quando há versão nova. */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ id: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" }, { headers: { "cache-control": "no-store" } });
}
