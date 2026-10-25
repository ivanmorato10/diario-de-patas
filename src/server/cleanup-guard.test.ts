/** Regressão (revisão 25/10/2026, C1): a limpeza nunca apaga arquivo de mídia viva, mesmo se enfileirado por engano. */
import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ removed: [] as string[], live: new Set(["u/arte.webp", "u/arte-thumb.webp"]) }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("./supabase", () => ({
  HttpError: class extends Error {},
  adminClient: () => ({
    storage: { from: () => ({ remove: async (keys: string[]) => { m.removed.push(...keys); return { error: null }; } }) },
    from: (table: string) => {
      const f: { col?: string; keys?: string[] } = {};
      const q: any = {};
      for (const k of ["select", "eq", "is", "lt", "neq", "order", "limit", "update", "delete", "insert"]) q[k] = () => q;
      q.in = (col: string, keys: string[]) => { f.col = col; f.keys = keys; return q; };
      q.then = (ok: any, no: any) => {
        let data: any = [];
        if (table === "storage_cleanup" && !f.col) data = [
          { id: 1, bucket: "media", object_key: "u/arte.webp", attempts: 0 },
          { id: 2, bucket: "media", object_key: "u/arte-thumb.webp", attempts: 0 },
          { id: 3, bucket: "media", object_key: "u/velha.webp", attempts: 0 },
        ];
        if (table === "media_assets" && f.col === "private_storage_key") data = (f.keys ?? []).filter((k) => m.live.has(k) && !k.includes("thumb")).map((k) => ({ private_storage_key: k, thumb_storage_key: k.replace(".webp", "-thumb.webp") }));
        return Promise.resolve({ data, error: null }).then(ok, no);
      };
      return q;
    },
  }),
}));
import { processCleanup } from "./rpc";

describe("limpeza de arquivos", () => {
  it("apaga só o arquivo sem dono; arte e miniatura em uso ficam", async () => {
    await processCleanup();
    expect(m.removed).toEqual(["u/velha.webp"]);
  });
});
