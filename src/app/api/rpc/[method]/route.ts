/**
 * Operações do modo real (MUDANCAS-V2 §8). Sessão obrigatória; erros no formato { code, message },
 * com a mensagem no idioma de quem pediu (cookie de idioma).
 */
import { NextResponse } from "next/server";
import { configMissing } from "@/server/config-check";
import { HttpError, requireUser } from "@/server/supabase";
import { requestLocale, translateKey, translator } from "@/server/i18n";
import { RPC } from "@/server/rpc";
import { perfOn, serverTimingHeader, withTiming } from "@/server/timing";

export const dynamic = "force-dynamic";
// A geração de artes continua depois da resposta (after) — até 5 minutos.
export const maxDuration = 300;

export async function POST(req: Request, ctx: { params: Promise<{ method: string }> }) {
  if (!perfOn()) return handle(req, ctx);
  const t = performance.now();
  const { result, span } = await withTiming(() => handle(req, ctx));
  result.headers.set("server-timing", serverTimingHeader(performance.now() - t, span));
  return result;
}

async function handle(req: Request, { params }: { params: Promise<{ method: string }> }) {
  const locale = await requestLocale();
  const missing = configMissing(locale);
  if (missing) return missing;
  const t = translator(locale);
  const fail = (status: number, code: string, key: string, values?: Record<string, string | number>) =>
    NextResponse.json({ code, message: translateKey(t, key, values) }, { status });
  const { method } = await params;
  const fn = Object.hasOwn(RPC, method) ? RPC[method] : undefined;
  if (!fn) return fail(404, "NOT_FOUND", "errors.unknownOperation");
  // Mesma origem: protege contra requisições forjadas de outros sites (cookies SameSite=Lax + checagem de Origin).
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return fail(403, "FORBIDDEN", "errors.badOrigin");
  try {
    const hint = req.headers.get("x-ddp-dog");
    const ctx = { ...(await requireUser()), dogHint: hint && /^[0-9a-f-]{36}$/i.test(hint) ? hint : null };
    const args = await req.json().catch(() => ({}));
    const result = await fn(ctx, args);
    // Conta excluída: apaga também as fotos guardadas no navegador (ficam em cache para abrir rápido).
    const headers: Record<string, string> = { "cache-control": "private, no-store" };
    if (method === "deleteAccount") headers["clear-site-data"] = '"cache"';
    return NextResponse.json(result ?? null, { headers });
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.code, e.message, e.params);
    console.error(`rpc ${method}:`, e);
    return fail(500, "SERVER", "errors.generic");
  }
}
