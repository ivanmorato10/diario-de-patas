/**
 * Proxy (antigo middleware, Next 16) — só no modo real (MUDANCAS-V2 §8):
 * renova a sessão Supabase nos cookies e leva quem não entrou para /entrar.
 * No modo demonstração não faz nada.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { REAL_MODE, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config/mode";

/** Páginas abertas sem conta. */
const PUBLIC = [/^\/$/, /^\/bem-vindo$/, /^\/entrar$/, /^\/auth\//, /^\/s\//, /^\/sobre$/, /^\/api\//, /^\/offline\.html$/];

export async function proxy(request: NextRequest) {
  if (!REAL_MODE) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supa = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });
  const { data } = await supa.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims && !PUBLIC.some((re) => re.test(path))) {
    const to = request.nextUrl.clone();
    to.pathname = "/entrar";
    to.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  // Tudo, menos arquivos estáticos e imagens.
  matcher: ["/((?!_next/static|_next/image|brand/|moments/|favicon|manifest|sw\\.js|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml)$).*)"],
};
