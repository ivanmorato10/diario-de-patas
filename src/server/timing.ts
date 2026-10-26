/**
 * Medição de desempenho (só com PERF_TIMING=1, nunca em produção): conta as idas ao Supabase de cada requisição
 * (quantas e quanto tempo, somando as que correm em paralelo) para o cabeçalho Server-Timing da rota /api/rpc.
 */
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export const perfOn = () => process.env.PERF_TIMING === "1" && !process.env.VERCEL;
interface Span { calls: number; ms: number; tables: Map<string, number> }
const store = new AsyncLocalStorage<Span>();

export function withTiming<T>(fn: () => Promise<T>): Promise<{ result: T; span: Span }> {
  const span: Span = { calls: 0, ms: 0, tables: new Map() };
  return store.run(span, async () => ({ result: await fn(), span }));
}

/** fetch do cliente Supabase que anota a ida ao banco na requisição em andamento. */
export const timedFetch: typeof fetch = async (input, init) => {
  const span = store.getStore();
  if (!span) return fetch(input, init);
  const t = performance.now();
  try {
    return await fetch(input, init);
  } finally {
    span.calls++;
    span.ms += performance.now() - t;
    const path = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).pathname.replace(/^\/(rest|auth|storage)\/v1\//, "$1:").split("/").slice(0, 2).join("/");
    span.tables.set(path, (span.tables.get(path) ?? 0) + 1);
  }
};

export function serverTimingHeader(totalMs: number, span: Span) {
  const tables = [...span.tables].map(([k, n]) => `${k}×${n}`).join(" ");
  return `app;dur=${totalMs.toFixed(1)}, db;dur=${span.ms.toFixed(1)};desc="${span.calls} chamadas", dbq;desc="${tables.replace(/"/g, "")}"`;
}
