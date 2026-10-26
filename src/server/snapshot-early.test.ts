/**
 * Regressão (desempenho, 25/10/2026): o snapshot começa as consultas do cachorro que a tela informou junto com a
 * conferência da participação. Cachorro de outra pessoa: recusado, nada devolvido. Cachorro certo: cada consulta
 * do diário sai uma vez só (nada em dobro).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ reads: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));
function db() {
  return {
    rpc: async () => ({ data: [], error: null }),
    from: (table: string) => {
      const eq: Record<string, any> = {};
      let op = "read";
      const q: any = {};
      for (const k of ["select", "is", "in", "order", "limit", "single", "maybeSingle", "gte", "like", "not"]) q[k] = () => q;
      q.eq = (k: string, v: any) => { eq[k] = v; return q; };
      for (const k of ["insert", "update", "upsert", "delete"]) q[k] = () => { op = k; return q; };
      q.then = (ok: any, no: any) => {
        const dog = eq.dog_id ?? eq["albums.dog_id"] ?? eq["visits.dog_id"] ?? eq["mission_instances.dog_id"];
        if (op === "read" && dog) m.reads.push(`${table}:${dog}`);
        let data: any = [];
        if (table === "profiles") data = eq.user_id ? { user_id: "u", timezone: "UTC", current_dog_id: "abu" } : [];
        if (table === "dog_members") data = eq.user_id ? [{ dog_id: "abu", role: "admin", created_at: "", dogs: { id: "abu", owner_id: "u", name: "Abu", preferences_json: {} } }] : [{ user_id: "u", role: "admin" }];
        if (table === "daily_plans") data = op === "read" && eq.plan_date ? { dog_id: "abu", plan_date: "2026-10-25", slots: {}, swaps: 0, shown: [] } : [];
        if (["health_profiles"].includes(table)) data = null;
        return Promise.resolve({ data, error: null, count: 0 }).then(ok, no);
      };
      return q;
    },
  };
}
vi.mock("./supabase", () => ({
  HttpError: class extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } },
  adminClient: () => db(),
}));
import { RPC } from "./rpc";

beforeEach(() => { m.reads = []; });

describe("snapshot com o cachorro da tela", () => {
  it("cachorro de que a pessoa não participa: recusado (nada do diário é devolvido)", async () => {
    await expect(RPC.snapshot({ user: { id: "u" }, supa: db(), dogHint: "pepe-de-outra-pessoa" } as any, {})).rejects.toThrow("errors.diaryGone");
  });
  it("cachorro certo: as consultas do diário saem uma vez só", async () => {
    const s: any = await RPC.snapshot({ user: { id: "u" }, supa: db(), dogHint: "abu" } as any, {});
    expect(s.dog.id).toBe("abu");
    const entries = m.reads.filter((r) => r === "diary_entries:abu");
    expect(entries).toHaveLength(1);
    expect(m.reads.some((r) => r.endsWith(":pepe-de-outra-pessoa"))).toBe(false);
  });
});
