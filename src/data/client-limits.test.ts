/** Regressão (auditoria 23/10/2026, itens opcionais): cache de fotos com teto e chamada que não fica presa. */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase-browser", () => ({ browserClient: () => ({}) }));
import { BLOB_CACHE_MAX, blobCacheSize, realRepository, rpc } from "./real-repository";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("cache de fotos", () => {
  it("não cresce sem limite e mantém a usada há pouco", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["x"]))));
    const r = realRepository();
    const first = r.getMediaBlob("m0", "thumb");
    for (let i = 1; i < BLOB_CACHE_MAX + 50; i++) {
      void r.getMediaBlob(`m${i}`, "thumb");
      if (i % 10 === 0) void r.getMediaBlob("m0", "thumb"); // a primeira continua em uso
    }
    expect(blobCacheSize()).toBe(BLOB_CACHE_MAX);
    expect(r.getMediaBlob("m0", "thumb")).toBe(first); // não baixou de novo
  });
});

describe("chamada ao servidor", () => {
  it("rede presa vira erro (o botão sai do “Salvando…”)", async () => {
    vi.stubGlobal("fetch", vi.fn((_u: string, init: RequestInit) => new Promise((_, no) => init.signal?.addEventListener("abort", () => no(new DOMException("timeout", "TimeoutError"))))));
    vi.useFakeTimers();
    const p = rpc("snapshot");
    const done = expect(p).rejects.toMatchObject({ code: "NETWORK" });
    await vi.advanceTimersByTimeAsync(61_000);
    await done;
  });
});
