/** Volta do link de entrada ou do Google/Apple (fluxo PKCE): troca o código pela sessão e segue para a página pedida. */
import { NextResponse } from "next/server";
import { userClient } from "@/server/supabase";

export const dynamic = "force-dynamic";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  if (code) {
    const supa = await userClient();
    const { error } = await supa.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  const kind = url.searchParams.has("error") ? "oauth" : "link";
  return NextResponse.redirect(new URL(`/entrar?erro=${kind}&next=${encodeURIComponent(next)}`, url.origin));
}
