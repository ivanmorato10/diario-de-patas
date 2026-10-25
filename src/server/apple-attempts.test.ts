/**
 * Regressão (revisão 25/10/2026, B2): cada tentativa de compra da Apple guarda o próprio diário de destino.
 * Antes, a 2ª tentativa (Pepe) sobrescrevia o destino da 1ª (Abu) ainda sem confirmação.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ attempts: new Map<string, any>(), members: new Set(["u:abu", "u:pepe"]), purchases: [] as any[], tx: {} as any }));
vi.mock("server-only", () => ({}));
vi.mock("./supabase", () => ({
  HttpError: class extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } },
  adminClient: () => ({
    from: (table: string) => {
      const eq: Record<string, any> = {};
      let op = "read", patch: any;
      const q: any = {};
      for (const k of ["select", "single", "maybeSingle"]) q[k] = () => q;
      q.eq = (k: string, v: any) => { eq[k] = v; return q; };
      q.insert = (v: any) => { op = "insert"; patch = v; return q; };
      q.then = (ok: any, no: any) => {
        let data: any = null;
        if (table === "apple_purchase_attempts") { if (op === "insert") m.attempts.set(patch.id, patch); else data = m.attempts.get(eq.id) ?? null; }
        if (table === "dog_members") data = m.members.has(`${eq.user_id}:${eq.dog_id}`) ? { dog_id: eq.dog_id } : null;
        if (table === "credit_purchases") {
          if (op === "insert") { data = { ...patch, id: `p${m.purchases.length}`, receipt_sent_at: "x" }; m.purchases.push(data); }
          else data = m.purchases.find((p) => p.provider_payment_id === eq.provider_payment_id || p.id === eq.id) ?? null;
        }
        return Promise.resolve({ data, error: null }).then(ok, no);
      };
      return q;
    },
  }),
}));
vi.mock("./family", () => ({ currentDog: async (c: any) => ({ id: c.dogHint ?? "abu", name: "Dog", role: "admin" }), requireEditor: () => {} }));
vi.mock("./payments", () => ({ grantCredits: async () => {}, sendReceipt: async () => {}, syncPurchase: async () => {}, toPurchase: (p: any) => p }));
vi.mock("@apple/app-store-server-library", () => ({
  Environment: { PRODUCTION: "Production", SANDBOX: "Sandbox" }, APIException: class extends Error {},
  AppStoreServerAPIClient: class { async getTransactionInfo() { return { signedTransactionInfo: "signed" }; } },
  SignedDataVerifier: class { async verifyAndDecodeTransaction() { return m.tx; } },
}));
import { appleConfirm, appleIntent } from "./apple";

const tx = (token: string) => ({ bundleId: "com.diariodepatas.app", appAccountToken: token, productId: "diariodepatas.credits.5", price: 2990, currency: "USD", quantity: 1 });
beforeEach(() => {
  m.attempts.clear(); m.purchases = []; m.members = new Set(["u:abu", "u:pepe"]);
  vi.stubEnv("APPLE_IAP_KEY_ID", "k"); vi.stubEnv("APPLE_IAP_ISSUER_ID", "i"); vi.stubEnv("APPLE_IAP_PRIVATE_KEY", "p");
});

describe("compra da Apple: destino por tentativa", () => {
  it("1ª tentativa no Abu, 2ª no Pepe, confirmação da 1ª chega depois: créditos no Abu", async () => {
    const ctx: any = { user: { id: "u" }, supa: {}, dogHint: "abu" };
    const a = (await appleIntent(ctx)).appAccountToken;
    const b = (await appleIntent({ ...ctx, dogHint: "pepe" })).appAccountToken;
    expect(a).not.toBe(b);
    m.tx = tx(b.toUpperCase()); // a Apple/Swift devolve maiúsculo
    expect(((await appleConfirm({ ...ctx, dogHint: "abu" }, { transactionId: "2" })) as any).dog_id).toBe("pepe");
    m.tx = tx(a);
    expect(((await appleConfirm({ ...ctx, dogHint: "pepe" }, { transactionId: "1" })) as any).dog_id).toBe("abu");
  });
  it("compra de outra conta no mesmo iPhone: recusada (e não finalizada)", async () => {
    const a = (await appleIntent({ user: { id: "outra" }, supa: {}, dogHint: "abu" } as any)).appAccountToken;
    m.tx = tx(a);
    await expect(appleConfirm({ user: { id: "u" }, supa: {} } as any, { transactionId: "3" })).rejects.toThrow("errors.paymentMismatch");
  });
  it("diário de destino sem acesso: pendência explícita, nunca outro diário", async () => {
    const ctx: any = { user: { id: "u" }, supa: {}, dogHint: "abu" };
    const a = (await appleIntent(ctx)).appAccountToken;
    m.members.delete("u:abu");
    m.tx = tx(a);
    await expect(appleConfirm({ ...ctx, dogHint: "pepe" }, { transactionId: "4" })).rejects.toThrow("errors.appleDiaryGone");
    expect(m.purchases).toEqual([]);
  });
});
