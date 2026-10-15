/**
 * Proxy (antigo middleware, Next 16) — só no modo real (MUDANCAS-V2 §8):
 * renova a sessão Supabase nos cookies e leva quem não entrou para /entrar.
 * No modo demonstração não faz nada.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { REAL_MODE, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config/mode";
import { isPublicPath } from "@/config/routes";
import { REFERRAL_COOKIE, isReferralCode } from "@/config/referrals";


/** Link de indicação (?ref=CODIGO): guarda o código por 30 dias, até a pessoa criar o diário. */
function keepReferral(request: NextRequest, res: NextResponse) {
  const ref = request.nextUrl.searchParams.get("ref")?.toUpperCase();
  if (ref && isReferralCode(ref)) res.cookies.set(REFERRAL_COOKIE, ref, { path: "/", maxAge: 30 * 86_400, sameSite: "lax", secure: true, httpOnly: true });
  return res;
}

export async function proxy(request: NextRequest) {
  if (!REAL_MODE) return NextResponse.next();
  return keepReferral(request, await route(request));
}

async function route(request: NextRequest) {
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
  if (!data?.claims && !isPublicPath(path)) {
    const to = request.nextUrl.clone();
    to.pathname = "/entrar";
    to.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }
  if (data?.claims && path === "/entrar") {
    // Já entrou: segue para onde ia (ex.: aceitar um convite), só caminhos internos.
    const n = request.nextUrl.searchParams.get("next");
    return NextResponse.redirect(new URL(n && n.startsWith("/") && !n.startsWith("//") ? n : "/", request.url));
  }
  return response;
}

export const config = {
  // Tudo, menos arquivos estáticos e imagens.
  matcher: ["/((?!_next/static|_next/image|brand/|moments/|favicon|manifest|sw\\.js|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml)$).*)"],
};
