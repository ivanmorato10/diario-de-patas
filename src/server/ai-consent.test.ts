/**
 * Regressão (revisão 25/10/2026, A1 — App Store 5.1.2(i)): nenhuma foto vai à IA (Google Gemini) sem autorização
 * na versão atual do texto. Conferido no servidor (não só escondendo o botão).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const m = vi.hoisted(() => ({ consentVersion: null as number | null, aiCalls: 0, image: Buffer.alloc(0), updates: [] as any[] }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("./supabase", () => ({
  HttpError: class extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } },
  adminClient: () => ({
    storage: { from: () => ({ download: async () => ({ data: new Blob([m.image]) }) }) },
    rpc: async () => ({ data: 10, error: null }),
    from: (table: string) => {
      let op = "read", patch: any;
      const q: any = {};
      for (const k of ["select", "eq", "is", "in", "gte", "or", "order", "limit", "single", "maybeSingle"]) q[k] = () => q;
      q.update = (v: any) => { op = "update"; patch = v; return q; };
      q.then = (ok: any, no: any) => {
        let data: any = null;
        if (table === "profiles") { if (op === "update") { m.updates.push(patch); data = [{ user_id: "u" }]; } else data = { ai_consent_version: m.consentVersion }; }
        if (table === "diary_entries") data = { id: "e", source: "free", media_asset_id: "a" };
        if (table === "media_assets") data = { private_storage_key: "k" };
        if (table === "generation_jobs") data = null;
        return Promise.resolve({ data, error: null, count: 0 }).then(ok, no);
      };
      return q;
    },
  }),
}));
vi.mock("./family", async (orig) => ({ ...(await orig<object>()), currentDog: async () => ({ id: "d", owner_id: "u", name: "Abu", role: "admin" }), requireEditor: () => {} }));
vi.mock("./art-generator", () => ({
  ProviderError: class extends Error { constructor(readonly code: string, msg: string) { super(msg); } },
  artGenerator: () => ({ assessPhoto: async () => { m.aiCalls++; return { dog: true, dogVisible: true, issues: [] }; }, generate: async () => { m.aiCalls++; throw new Error("x"); }, check: async () => ({ dog: true }) }),
}));
import { studioAiConsent, studioCheckPhoto, studioCreateJob } from "./studio";

const ctx: any = { user: { id: "u" }, supa: { from: (t: string) => (globalThis as any).fakeFrom(t) } };
beforeEach(async () => {
  m.image = await sharp({ create: { width: 900, height: 900, channels: 3, background: "#996633" } }).jpeg().toBuffer();
  Object.assign(m, { consentVersion: null, aiCalls: 0, updates: [] });
  vi.stubEnv("GEMINI_API_KEY", "x");
  const { adminClient } = await import("./supabase");
  (globalThis as any).fakeFrom = (t: string) => (adminClient() as any).from(t);
});

describe("autorização para enviar fotos à IA", () => {
  it("sem autorização: conferir a foto não chama a IA (só checagens locais)", async () => {
    const r = await studioCheckPhoto(ctx, { entryId: "11111111-1111-4111-8111-111111111111", crop: null });
    expect(m.aiCalls).toBe(0);
    expect(r.aiChecked).toBeFalsy();
  });
  it("com autorização na versão atual: conferir chama a IA", async () => {
    m.consentVersion = 1;
    await studioCheckPhoto(ctx, { entryId: "11111111-1111-4111-8111-111111111111", crop: null });
    expect(m.aiCalls).toBe(1);
  });
  it("autorização de uma versão antiga do texto não vale", async () => {
    m.consentVersion = 0;
    await studioCheckPhoto(ctx, { entryId: "11111111-1111-4111-8111-111111111111", crop: null });
    expect(m.aiCalls).toBe(0);
  });
  it("criar a arte sem autorização é recusado no servidor (mesmo com recorte)", async () => {
    await expect(studioCreateJob(ctx, { entryId: "11111111-1111-4111-8111-111111111111", presetId: "aniversario", idempotencyKey: "22222222-2222-4222-8222-222222222222", crop: { x: 0, y: 0, w: 0.5, h: 0.5 } }, () => {})).rejects.toThrow("errors.aiConsentNeeded");
    expect(m.aiCalls).toBe(0);
  });
  it("autorizar e retirar gravam no perfil", async () => {
    await studioAiConsent(ctx, { granted: true });
    await studioAiConsent(ctx, { granted: false });
    expect(m.updates[0]).toMatchObject({ ai_consent_version: 1 });
    expect(m.updates[1]).toMatchObject({ ai_consent_version: null, ai_consent_at: null });
  });
});
