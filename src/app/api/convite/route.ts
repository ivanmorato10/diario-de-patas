/** Prévia de um convite de família (público): de quem é e qual papel. Não dá acesso a nada. */
import { NextResponse } from "next/server";
import { HttpError } from "@/server/supabase";
import { inviteRateLimited, previewInvite } from "@/server/family";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return NextResponse.json({ message: "Origem inválida." }, { status: 403 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (inviteRateLimited(ip)) return NextResponse.json({ message: "Muitas tentativas. Espere alguns minutos." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  try {
    return NextResponse.json(await previewInvite(String(body?.code ?? "")));
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, "SERVER", "Algo deu errado.");
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
