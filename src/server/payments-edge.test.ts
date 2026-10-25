/**
 * Regressão (auditoria 23/10/2026, item 10): casos-limite de pagamento.
 * Banco falso por tabela: cada consulta registra filtros e devolve o que o teste preparou.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  purchases: [] as any[], late: null as any, reads: 0, ledger: new Set<string>(), insertError: null as any, inserts: 0, granted: [] as string[], receipts: [] as string[],
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("./supabase", () => ({
  HttpError: class extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } },
  adminClient: () => ({
    rpc: async (name: string, args: any) => {
      if (name === "grant_purchase_credits") { m.granted.push(args.p_purchase); m.ledger.add(`purchase:${args.p_purchase}`); }
      return { data: null, error: null };
    },
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "" } } }) } },
    from: (table: string) => {
      const f: { eq: [string, any][]; gt?: [string, any]; isNull: string[]; limit?: number; inKeys?: string[]; single?: boolean; op: string; patch?: any } = { eq: [], isNull: [], op: "read" };
      const q: any = {};
      q.select = () => q; q.order = () => q; q.gte = () => q; q.or = () => q;
      q.eq = (k: string, v: any) => { f.eq.push([k, v]); return q; };
      q.is = (k: string) => { f.isNull.push(k); return q; };
      q.gt = (k: string, v: any) => { f.gt = [k, v]; return q; };
      q.in = (k: string, v: any[]) => { if (k === "idempotency_key") f.inKeys = v; return q; };
      q.limit = (n: number) => { f.limit = n; return q; };
      q.maybeSingle = () => { f.single = true; return q; }; q.single = q.maybeSingle;
      q.insert = () => { f.op = "insert"; m.inserts++; return q; };
      q.update = (patch: any) => { f.op = "update"; f.patch = patch; return q; };
      const run = () => {
        if (table === "profiles") return { data: { region: "BR" }, error: null };
        if (table === "credit_ledger") return { data: (f.inKeys ?? []).filter((k) => m.ledger.has(k)).map((idempotency_key) => ({ idempotency_key })), error: null };
        if (table === "dogs") return { data: { name: "Abu" }, error: null };
        if (table !== "credit_purchases") return { data: null, error: null };
        if (f.op === "insert") return m.insertError ? { data: null, error: m.insertError } : { data: null, error: { message: "não esperado" } };
        if (f.op === "update") {
          // Reserva do comprovante: marca e devolve a linha (nada de SMTP no teste: envio "skipped").
          const id = f.eq.find(([k]) => k === "id")?.[1];
          const row = m.purchases.find((p) => p.id === id);
          if (row && f.patch.receipt_sent_at) { row.receipt_sent_at = f.patch.receipt_sent_at; m.receipts.push(id); }
          return { data: row ? { ...row, owner_id: null } : null, error: null };
        }
        if (m.late && m.reads++ >= 1) m.purchases = [m.late]; // o outro pedido gravou depois da nossa 1ª leitura
        let rows = m.purchases.filter((p) => f.eq.every(([k, v]) => p[k] === v) && f.isNull.every((k) => p[k] == null));
        if (f.gt) rows = rows.filter((p) => p.id > f.gt![1]);
        rows = rows.sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, f.limit ?? rows.length);
        return { data: f.single ? rows[0] ?? null : rows, error: null };
      };
      q.then = (ok: any, no: any) => Promise.resolve(run()).then(ok, no);
      return q;
    },
  }),
}));
vi.mock("./family", () => ({ currentDog: async () => ({ id: "dog", owner_id: "user", name: "Abu", role: "admin" }), requireEditor: () => {} }));
vi.mock("./i18n", async (orig) => ({ ...(await orig<object>()), localeOf: async () => "pt-BR", translator: () => () => "" }));
vi.mock("./mailer", () => ({ sendPurchaseConfirmed: async () => "skipped" }));

import { createPurchase, deliverApproved, mapStripeSession } from "./payments";

const ctx: any = { user: { id: "user", email: "" }, supa: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { region: "BR" }, error: null }) }) }) }) } };
const key = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  Object.assign(m, { purchases: [], late: null, reads: 0, ledger: new Set(), insertError: null, inserts: 0, granted: [], receipts: [] });
  process.env.PAYMENTS_ENABLED = "true"; process.env.PAYMENTS_FAKE = "1"; delete process.env.VERCEL;
});

describe("criar compra: dois toques ao mesmo tempo", () => {
  it("conflito na gravação (23505) devolve a MESMA compra do outro pedido", async () => {
    m.insertError = { code: "23505", message: "duplicate key" };
    // O outro pedido gravou entre a nossa leitura e a nossa gravação: a leitura inicial não acha, a releitura acha.
    m.late = { id: "p-1", idempotency_key: `user:${key}`, status: "pending", provider: "teste", provider_payment_id: "fake-1", package_id: "p1", credits: 1, amount_cents: 100, currency: "BRL", created_at: "" };
    const out = await createPurchase(ctx, { packageId: "p1", idempotencyKey: key });
    expect(out.id).toBe("p-1");
    expect(m.inserts).toBe(1);
  });
  it("outro erro na gravação vira erro (nunca segue com compra vazia)", async () => {
    m.insertError = { code: "08006", message: "connection lost" };
    await expect(createPurchase(ctx, { packageId: "p1", idempotencyKey: key })).rejects.toThrow("errors.saveFailed");
  });
});

describe("entrega das aprovadas", () => {
  it("percorre todas as páginas (mais de 500, de qualquer data) e entrega créditos antes do comprovante", async () => {
    m.purchases = Array.from({ length: 650 }, (_, i) => ({ id: `p-${String(i).padStart(4, "0")}`, status: "approved", receipt_sent_at: null, dog_id: "dog", credits: 1 }));
    for (let i = 0; i < 650; i += 2) m.ledger.add(`purchase:p-${String(i).padStart(4, "0")}`); // metade já tinha créditos
    const r = await deliverApproved();
    expect(r.granted).toBe(325);
    expect(new Set(m.receipts).size).toBe(650);
    expect(m.purchases.every((p) => p.receipt_sent_at)).toBe(true);
  });
});

describe("estorno no Stripe", () => {
  const paid = (charge: any) => mapStripeSession({ status: "complete", payment_status: "paid", amount_total: 299, payment_intent: { latest_charge: charge } });
  it("parcial mantém aprovado (créditos não somem); total ou contestação = estornado", () => {
    expect(paid({ amount: 299, amount_refunded: 100 })).toBe("approved");
    expect(paid({ amount: 299, amount_refunded: 299 })).toBe("refunded");
    expect(paid({ amount_refunded: 299 })).toBe("refunded"); // sem amount na cobrança: usa o total da sessão
    expect(paid({ amount: 299, amount_refunded: 0, disputed: true })).toBe("refunded");
  });
});
