/**
 * Regressão (auditoria 23/10/2026, itens opcionais): o servidor recusa datas no futuro pelo "hoje" do fuso
 * da pessoa (o mesmo da tela), e não pelo fuso mais adiantado do mundo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ tz: "America/Sao_Paulo", writes: [] as string[] }));
function fakeDb() {
  return {
    from: (table: string) => {
      let op = "read";
      const q: any = {};
      for (const k of ["select", "eq", "is", "in", "order", "limit", "match"]) q[k] = () => q;
      for (const k of ["insert", "update", "upsert"]) q[k] = () => { op = k; m.writes.push(`${table}:${k}`); return q; };
      q.maybeSingle = () => q; q.single = () => q;
      const row = table === "profiles" ? { timezone: m.tz, user_id: "user" } : null;
      q.then = (ok: any, no: any) => Promise.resolve(op === "read" ? { data: row, error: null } : { data: { id: "11111111-1111-4111-8111-111111111111", date: "2026-10-24", kg: 10 }, error: null }).then(ok, no);
      return q;
    },
  };
}
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("./supabase", () => ({
  HttpError: class extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } },
  adminClient: () => fakeDb(),
}));
vi.mock("./family", async (orig) => ({ ...(await orig<object>()), currentDog: async () => ({ id: "dog", owner_id: "user", name: "Abu", role: "admin" }), requireEditor: () => {} }));
vi.mock("./notify", async (orig) => ({ ...(await orig<object>()), notifyFamily: () => {} }));

import { saveLetter } from "./letters";
import { RPC } from "./rpc";

const ctx: any = { user: { id: "user" }, supa: fakeDb() };
beforeEach(() => { m.writes = []; vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-24T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("datas no futuro", () => {
  it("cartinha: amanhã em São Paulo é recusada (antes passava por causa do UTC+14)", async () => {
    await expect(saveLetter(ctx, { body: "Abu!", date: "2026-10-25", requestKey: "11111111-1111-4111-8111-111111111111" })).rejects.toThrow("errors.dateUpToToday");
    expect(m.writes).toEqual([]);
  });
  it("cartinha: em Kiritimati (UTC+14) já é dia 25: vale", async () => {
    m.tz = "Pacific/Kiritimati";
    await expect(saveLetter(ctx, { body: "Abu!", date: "2026-10-25", requestKey: "11111111-1111-4111-8111-111111111111" })).resolves.toBeTruthy();
    m.tz = "America/Sao_Paulo";
  });
  it("peso: pesagem de amanhã é recusada antes de gravar", async () => {
    await expect(RPC.addWeight(ctx, { date: "2026-10-25", kg: 10, key: "11111111-1111-4111-8111-111111111111" })).rejects.toThrow("errors.dateUpToToday");
    expect(m.writes).toEqual([]);
  });
});
