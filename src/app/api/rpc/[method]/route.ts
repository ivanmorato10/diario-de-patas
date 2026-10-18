/** Operações do modo real (MUDANCAS-V2 §8). Sessão obrigatória; erros no formato { code, message }. */
import { NextResponse } from "next/server";
import { configMissing } from "@/server/config-check";
import { HttpError, requireUser } from "@/server/supabase";
import { RPC } from "@/server/rpc";

export const dynamic = "force-dynamic";
// A geração de artes continua depois da resposta (after) — até 5 minutos.
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ method: string }> }) {
  const missing = configMissing();
  if (missing) return missing;
  const { method } = await params;
  const fn = Object.hasOwn(RPC, method) ? RPC[method] : undefined;
  if (!fn) return NextResponse.json({ code: "NOT_FOUND", message: "Operação desconhecida." }, { status: 404 });
  // Mesma origem: protege contra requisições forjadas de outros sites (cookies SameSite=Lax + checagem de Origin).
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return NextResponse.json({ code: "FORBIDDEN", message: "Origem inválida." }, { status: 403 });
  try {
    const hint = req.headers.get("x-ddp-dog");
    const ctx = { ...(await requireUser()), dogHint: hint && /^[0-9a-f-]{36}$/i.test(hint) ? hint : null };
    const args = await req.json().catch(() => ({}));
    const result = await fn(ctx, args);
    return NextResponse.json(result ?? null, { headers: { "cache-control": "private, no-store" } });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ code: e.code, message: e.message }, { status: e.status });
    console.error(`rpc ${method}:`, e);
    return NextResponse.json({ code: "SERVER", message: "Algo deu errado do nosso lado. Tente de novo." }, { status: 500 });
  }
}
