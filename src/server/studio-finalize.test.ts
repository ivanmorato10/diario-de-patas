/**
 * Regressão (auditoria 23/10/2026, item 3): falha DEPOIS da conclusão (ex.: registro de uso) não transforma a arte
 * entregue em falha; falha ANTES da conclusão devolve a reserva e manda os arquivos já enviados para a limpeza.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const m = vi.hoisted(() => ({ image: Buffer.alloc(0), state: "queued", released: false, finalized: false, finalizeFails: false, usageFails: true, cleanup: [] as string[], reserved: true, generated: false }));
vi.mock("./supabase", () => ({
  HttpError: class extends Error {},
  adminClient: () => ({
    storage: { from: () => ({ download: async () => ({ data: new Blob([m.image]) }), upload: async () => ({ error: null }) }) },
    rpc: async (name: string, a: any) => {
      if (name === "finalize_studio_job") {
        if (m.finalizeFails) return { data: null, error: { message: "boom" } };
        m.finalized = true; m.state = "succeeded"; return { data: "output-entry", error: null };
      }
      if (name === "settle_credit" && a.p_op === "release") { m.released = true; return { data: true, error: null }; }
      return { data: true, error: null };
    },
    from: (table: string) => {
      let op = "read", patch: any;
      const q: any = {};
      for (const k of ["eq", "in", "is", "select", "single", "maybeSingle", "order", "limit"]) q[k] = () => q;
      for (const k of ["update", "insert", "upsert"]) q[k] = (v: any) => { op = k; patch = v; return q; };
      q.then = (ok: any, no: any) => {
        let data: any = null, error: any = null;
        if (table === "generation_jobs" && op === "update") {
          if (patch.state === "processing") { m.state = "processing"; data = [{ id: "job", theme_id: "aniversario", input_entry_id: "input", owner_id: "u", dog_id: "d", aspect: "1:1", cost_usd: 0.04, requested_by: "u" }]; }
          else if (patch.state === "failed" && m.state !== "succeeded") { m.state = "failed"; data = [{ id: "job" }]; }
          else data = [];
        }
        if (table === "diary_entries") data = { id: "input", media_asset_id: "asset", deleted_at: null };
        if (table === "media_assets") data = { private_storage_key: "input.webp" };
        if (table === "profiles") data = { timezone: "UTC" };
        if (table === "albums") data = { id: "album" };
        if (table === "dogs") data = { name: "Abu" };
        if (table === "credit_ledger") data = m.reserved ? { id: 1 } : null;
        if (table === "usage_events" && m.usageFails) error = { code: "FAIL", message: "usage write failed" };
        if (table === "storage_cleanup" && op === "insert") m.cleanup.push(...patch.map((x: any) => x.object_key));
        return Promise.resolve({ data, error }).then(ok, no);
      };
      return q;
    },
  }),
}));
vi.mock("./art-generator", () => ({ ProviderError: class extends Error { constructor(readonly code: string, msg: string) { super(msg); } }, artGenerator: () => ({ generate: async () => { m.generated = true; return { image: m.image, mime: "image/png", model: "fake" }; }, check: async () => ({ dog: true, text: false }) }) }));
vi.mock("./i18n", () => ({ localeOf: async () => "pt-BR", translator: () => Object.assign(() => "Arte", { has: () => true }) }));
vi.mock("./notify", () => ({ notifyFamily: async () => {} }));
import { processJob } from "./studio";

beforeEach(async () => {
  m.image = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#aabbcc" } }).png().toBuffer();
  Object.assign(m, { state: "queued", released: false, finalized: false, finalizeFails: false, usageFails: true, cleanup: [], reserved: true, generated: false });
});

describe("conclusão da arte", () => {
  it("registro de uso falhando depois da conclusão: arte continua entregue, sem falha nem devolução", async () => {
    await processJob("job");
    expect(m.finalized).toBe(true);
    expect(m.state).toBe("succeeded");
    expect(m.released).toBe(false);
  });
  it("conclusão falhando: job falha, reserva volta e os arquivos enviados vão para a limpeza", async () => {
    m.finalizeFails = true;
    await processJob("job");
    expect(m.state).toBe("failed");
    expect(m.released).toBe(true);
    expect(m.cleanup.length).toBe(2); // arte e miniatura
  });
  it("sem crédito reservado: falha sem chamar a IA paga", async () => {
    m.reserved = false;
    await processJob("job");
    expect(m.generated).toBe(false);
    expect(m.state).toBe("failed");
  });
});
