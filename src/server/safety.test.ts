/** Regressão (revisão 25/10/2026, A2 — App Store 1.2): denunciar conteúdo/pessoa/álbum e bloquear pessoa. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  members: [] as { dog_id: string; user_id: string }[], entries: new Map<string, any>(), reports: [] as any[], blocks: [] as any[], emails: [] as any[],
}));
vi.mock("server-only", () => ({}));
vi.mock("./mailer", () => ({ sendReportToSupport: async (r: any) => { m.emails.push(r); } }));
vi.mock("./supabase", () => ({
  HttpError: class extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } },
  adminClient: () => ({
    from: (table: string) => {
      const eq: Record<string, any> = {}, inn: Record<string, any[]> = {};
      let op = "read", patch: any;
      const q: any = {};
      for (const k of ["select", "gte", "single", "maybeSingle"]) q[k] = () => q;
      q.eq = (k: string, v: any) => { eq[k] = v; return q; };
      q.in = (k: string, v: any[]) => { inn[k] = v; return q; };
      for (const k of ["insert", "upsert", "delete"]) q[k] = (v: any) => { op = k; patch = v; return q; };
      q.then = (ok: any, no: any) => {
        let data: any = null, count = 0;
        if (table === "dog_members") data = m.members.filter((r) => r.user_id === eq.user_id);
        if (table === "diary_entries" || table === "letters") data = m.entries.get(eq.id) ?? null;
        if (table === "content_reports") { if (op === "insert") { m.reports.push(patch); data = { id: `r${m.reports.length}` }; } else count = m.reports.length; }
        if (table === "user_blocks") {
          if (op === "upsert") m.blocks.push(patch);
          else if (op === "delete") m.blocks = m.blocks.filter((b) => !(b.blocker_id === eq.blocker_id && b.blocked_id === eq.blocked_id));
          else data = m.blocks.filter((b) => (eq.blocked_id === undefined || b.blocked_id === eq.blocked_id) && (!inn.blocker_id || inn.blocker_id.includes(b.blocker_id)) && (eq.blocker_id === undefined || b.blocker_id === eq.blocker_id));
        }
        return Promise.resolve({ data, error: null, count }).then(ok, no);
      };
      return q;
    },
  }),
}));
import { blockUser, reportContent, reportShare, whoBlocked } from "./safety";

const ana = "11111111-1111-4111-8111-111111111111", beto = "22222222-2222-4222-8222-222222222222", foto = "33333333-3333-4333-8333-333333333333", estranho = "44444444-4444-4444-8444-444444444444";
const ctx = (id: string): any => ({ user: { id, email: `${id}@x.test` }, supa: {} });
beforeEach(() => {
  m.members = [{ dog_id: "abu", user_id: ana }, { dog_id: "abu", user_id: beto }, { dog_id: "rex", user_id: estranho }];
  m.entries = new Map([[foto, { dog_id: "abu", created_by: beto }]]);
  m.reports = []; m.blocks = []; m.emails = [];
});

describe("denúncia e bloqueio", () => {
  it("denunciar a foto de outra pessoa do diário: registra, avisa o suporte e (se pedir) bloqueia quem publicou", async () => {
    const r = await reportContent(ctx(ana), { targetType: "entry", targetId: foto, reason: "harassment", details: " ofensa ", block: true });
    expect(r.blocked).toBe(true);
    expect(m.reports[0]).toMatchObject({ reporter_id: ana, target_type: "entry", reported_user_id: beto, reason: "harassment", details: "ofensa" });
    expect(m.emails).toHaveLength(1);
    expect(await whoBlocked(beto, [ana])).toEqual(new Set([ana])); // Ana não recebe mais avisos do Beto
  });
  it("não dá para denunciar o que não vê (outro diário) nem bloquear quem nunca dividiu diário", async () => {
    await expect(reportContent(ctx(estranho), { targetType: "entry", targetId: foto, reason: "spam" })).rejects.toThrow("errors.notFoundShort");
    await expect(blockUser(ctx(ana), { userId: estranho, blocked: true })).rejects.toThrow("errors.notFoundShort");
    expect(m.reports).toEqual([]);
  });
  it("bloquear e desbloquear alguém do diário (qualquer papel)", async () => {
    await blockUser(ctx(beto), { userId: ana, blocked: true });
    expect(await whoBlocked(ana, [beto])).toEqual(new Set([beto]));
    await blockUser(ctx(beto), { userId: ana, blocked: false });
    expect(await whoBlocked(ana, [beto])).toEqual(new Set());
  });
  it("álbum público: denúncia sem conta vai para o suporte", async () => {
    await reportShare("share-1", "abu", { reason: "inappropriate", details: "" });
    expect(m.reports[0]).toMatchObject({ target_type: "share", target_id: "share-1", reason: "inappropriate" });
    expect(m.emails[0].reporter).toContain("visitante");
  });
  it("motivo inválido é recusado", async () => {
    await expect(reportShare("share-1", null, { reason: "qualquer" })).rejects.toThrow();
  });
});
