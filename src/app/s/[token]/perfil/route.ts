/** Foto de perfil do cachorro num link compartilhado: só enquanto o link vale (revogado → 404). */
import { NextResponse } from "next/server";
import { REAL_MODE } from "@/config/mode";
import { resolveShare } from "@/server/rpc";
import { adminClient } from "@/server/supabase";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!REAL_MODE) return new NextResponse(null, { status: 404 });
  const { token } = await params;
  const share = await resolveShare(token).catch(() => null);
  if (!share?.avatar) return new NextResponse(null, { status: 404 });
  const { data } = await adminClient().storage.from("media").download(share.avatar.key);
  if (!data) return new NextResponse(null, { status: 404 });
  return new NextResponse(data, { headers: { "content-type": data.type || "image/webp", "cache-control": "no-store", "x-robots-tag": "noindex", "x-content-type-options": "nosniff" } });
}
