/** Entrar com um código de convite (público): valida o código e devolve o token para a sessão. */
import { NextResponse } from "next/server";
import { HttpError } from "@/server/supabase";
import { redeemAccessCode } from "@/server/access-codes";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return NextResponse.json({ code: "FORBIDDEN", message: "Origem inválida." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  try {
    return NextResponse.json(await redeemAccessCode(String(body?.code ?? ""), ip));
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, "SERVER", "Algo deu errado.");
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
