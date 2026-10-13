/** Foto de um link compartilhado: revalida o link a CADA acesso — revogado ou fora da seleção → 404. */
import { NextResponse } from "next/server";
import { REAL_MODE } from "@/config/mode";
import { resolveShare } from "@/server/rpc";
import { adminClient } from "@/server/supabase";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string; entry: string }> }) {
  if (!REAL_MODE) return new NextResponse(null, { status: 404 });
  const { token, entry } = await params;
  const share = await resolveShare(token).catch(() => null);
  const item = share?.entries.find((e) => e.id === entry);
  if (!item) return new NextResponse(null, { status: 404 });
  const { data } = await adminClient().storage.from("media").download(item.key);
  if (!data) return new NextResponse(null, { status: 404 });
  return new NextResponse(data, {
    headers: { "content-type": data.type || "image/webp", "cache-control": "no-store", "x-robots-tag": "noindex", "x-content-type-options": "nosniff" },
  });
}
