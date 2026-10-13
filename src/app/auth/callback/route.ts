/** Volta do link de entrada ou do Google/Apple (fluxo PKCE): troca o código pela sessão e segue para a página pedida. */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { userClient } from "@/server/supabase";

export const dynamic = "force-dynamic";

/** Só caminhos internos conhecidos; qualquer outra coisa volta para o início (que decide entre Hoje e a apresentação). */
const safeNext = (n: string | null | undefined) => {
  if (!n || !n.startsWith("/") || n.startsWith("//")) return "/";
  return /^\/(hoje|missoes|guardar|diario|albuns|cuidados|config|sobre|estudio|comecar|bem-vindo)(\/|\?|$)/.test(n) ? n : "/";
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const fromCookie = jar.get("ddp_next")?.value;
  const next = safeNext(url.searchParams.get("next") ?? (fromCookie ? decodeURIComponent(fromCookie) : null));
  const code = url.searchParams.get("code");
  const done = (to: string) => {
    const res = NextResponse.redirect(new URL(to, url.origin));
    res.cookies.set("ddp_next", "", { path: "/auth", maxAge: 0 });
    return res;
  };
  if (code) {
    const supa = await userClient();
    const { error } = await supa.auth.exchangeCodeForSession(code);
    if (!error) return done(next);
  }
  const kind = url.searchParams.has("error") ? "oauth" : "link";
  return done(`/entrar?erro=${kind}&next=${encodeURIComponent(next)}`);
}
