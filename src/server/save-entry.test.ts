/**
 * Regressão (desempenho, 25/10/2026): guardar foto confere o envio junto do salvamento (uma viagem a menos) sem
 * perder nenhuma regra: foto de outro diário é recusada, arquivo falso é recusado e apagado, repetição não duplica.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const m = vi.hoisted(() => ({ media: null as any, prior: null as any, inserts: [] as any[], removed: [] as string[], file: Buffer.alloc(0), count: 3 }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));
function db() {
  return {
    storage: { from: () => ({ download: async () => ({ data: new Blob([m.file]), error: null }), remove: async (k: string[]) => { m.removed.push(...k); return { error: null }; } }) },
    rpc: async () => ({ data: null, error: null }),
    from: (table: string) => {
      const eq: Record<string, any> = {};
      let op = "read", patch: any;
      const q: any = {};
      for (const k of ["select", "is", "in", "order", "limit", "single", "maybeSingle", "not"]) q[k] = () => q;
      q.eq = (k: string, v: any) => { eq[k] = v; return q; };
      for (const k of ["insert", "update", "delete", "upsert"]) q[k] = (v: any) => { op = k; patch = v; return q; };
      q.then = (ok: any, no: any) => {
        let data: any = null, count: number | null = null;
        if (table === "profiles") data = { timezone: "America/Sao_Paulo", user_id: "u" };
        if (table === "dog_members") data = [{ dog_id: "abu", role: "admin", created_at: "", dogs: { id: "abu", owner_id: "u", name: "Abu" } }];
        if (table === "media_assets") { if (op === "update") Object.assign(m.media, patch); else if (op === "delete") m.media = null; else data = m.media; }
        if (table === "diary_entries") {
          if (op === "insert") { m.inserts.push(patch); data = { id: "e1", ...patch }; }
          else if (eq.request_key) data = m.prior;
          else if (eq.media_asset_id) data = [];
          else count = m.count;
        }
        if (table === "referrals") data = null;
        return Promise.resolve({ data, error: null, count }).then(ok, no);
      };
      return q;
    },
  };
}
vi.mock("./supabase", () => ({
  HttpError: class extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } },
  adminClient: () => db(),
}));
vi.mock("./notify", async (orig) => ({ ...(await orig<object>()), notifyFamily: () => {} }));
import { RPC } from "./rpc";

const ctx: any = { user: { id: "u" }, supa: db() };
const args = { requestKey: "11111111-1111-4111-8111-111111111111", mediaId: "22222222-2222-4222-8222-222222222222", caption: "Oi", occurredDate: "2026-10-20", source: "free", albumIds: [], confirmMedia: true };
beforeEach(async () => {
  m.file = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#996633" } }).webp().toBuffer();
  m.media = { id: args.mediaId, dog_id: "abu", status: "pending_upload", private_storage_key: "u/x.webp", thumb_storage_key: "u/x-thumb.webp", mime: "image/webp", kind: "photo" };
  m.prior = null; m.inserts = []; m.removed = []; m.count = 3;
});

describe("guardar foto com a conferência do envio junto", () => {
  it("confere o arquivo, deixa a foto pronta e grava uma lembrança", async () => {
    await RPC.saveEntry(ctx, args);
    expect(m.media.status).toBe("ready");
    expect(m.inserts).toHaveLength(1);
  });
  it("foto de outro diário: recusada, nada gravado", async () => {
    m.media.dog_id = "pepe";
    await expect(RPC.saveEntry(ctx, args)).rejects.toThrow("errors.uploadNotFound");
    expect(m.inserts).toEqual([]);
  });
  it("arquivo que não é foto: recusado e apagado do armazenamento", async () => {
    m.file = Buffer.from("isto não é uma imagem");
    await expect(RPC.saveEntry(ctx, args)).rejects.toThrow("errors.notAPhoto");
    expect(m.removed).toEqual(["u/x.webp", "u/x-thumb.webp"]);
    expect(m.inserts).toEqual([]);
  });
  it("repetição (mesma chave): devolve a lembrança existente, sem gravar outra", async () => {
    m.prior = { id: "e0", media_asset_id: args.mediaId, caption: "Oi", occurred_date: "2026-10-20", created_at: "", source: "free" };
    await RPC.saveEntry(ctx, args);
    expect(m.inserts).toEqual([]);
  });
  it("diário cheio: recusado antes de gravar", async () => {
    m.count = 100;
    await expect(RPC.saveEntry(ctx, args)).rejects.toThrow("errors.fullDiary");
    expect(m.inserts).toEqual([]);
  });
});
