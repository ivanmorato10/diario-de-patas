/**
 * Regressão (auditoria 23/10/2026, item 2): erro devolvido pelo banco NÃO pode virar sucesso.
 * Banco falso: leituras funcionam; toda gravação (insert/update/delete/upsert) devolve { error }.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ ops: [] as string[] }));
vi.mock("./supabase", () => ({
  HttpError: class extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } },
  adminClient: () => ({
    from: (table: string) => {
      let op = "read", single = false;
      const q: any = {};
      for (const k of ["select", "eq", "match", "is", "in", "order", "limit"]) q[k] = () => q;
      for (const k of ["update", "delete", "insert", "upsert"]) q[k] = () => { op = k; m.ops.push(`${table}:${k}`); return q; };
      const readRow = () => (table === "letters" ? { id: "11111111-1111-4111-8111-111111111111", created_by: "user" }
        : table === "diary_entries" ? { created_by: "other" }
        : table === "dog_members" ? (single ? { dog_id: "dog", role: "editor", dogs: { owner_id: "owner" } } : [{ dog_id: "dog", role: "admin", created_at: "", dogs: { id: "dog", owner_id: "owner", name: "Abu" } }])
        : table === "profiles" ? { current_dog_id: "dog" } : null);
      q.maybeSingle = () => { single = true; return q; }; q.single = q.maybeSingle;
      q.then = (ok: any, no: any) => Promise.resolve(op === "read" ? { data: readRow(), error: null, count: 2 } : { data: null, error: { message: "database unavailable" } }).then(ok, no);
      return q;
    },
  }),
}));
vi.mock("./family", async (orig) => {
  const real = await orig<typeof import("./family")>();
  return { ...real, currentDog: async () => ({ id: "dog", owner_id: "owner", name: "Abu", role: "admin" }) };
});
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("./i18n", () => ({ requestLocale: async () => "pt-BR", translator: () => () => "", localesOf: async () => new Map() }));

import { deleteLetter, toggleBone, updateLetter } from "./letters";
import { markNotificationsRead, removePushSubscription, saveNativePush, savePushSubscription } from "./notify";
import { leaveDiary, removeMember, switchDog, updateMember } from "./family";

const ctx: any = { user: { id: "user" }, supa: {} };
const id = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
beforeEach(() => { m.ops = []; });

describe("gravação com erro do banco vira erro (nunca sucesso falso)", () => {
  const cases: [string, () => Promise<unknown>, string][] = [
    ["editar cartinha", () => updateLetter(ctx, { id, body: "Abu!", date: "2026-10-20" }), "letters:update"],
    ["apagar cartinha", () => deleteLetter(ctx, { id }), "letters:delete"],
    ["dar ossinho", () => toggleBone(ctx, { targetType: "entry", targetId: id }), "bones:insert"],
    ["ligar avisos do navegador", () => savePushSubscription(ctx, { endpoint: "https://example.com/push", keys: { p256dh: "x", auth: "y" } }), "push_subscriptions:upsert"],
    ["ligar avisos do iPhone", () => saveNativePush(ctx, { token: "a".repeat(64) }), "push_subscriptions:upsert"],
    ["desligar avisos", () => removePushSubscription(ctx, { endpoint: "https://example.com/push" }), "push_subscriptions:delete"],
    ["marcar avisos como lidos", () => markNotificationsRead(ctx, { ids: [id] }), "notifications:update"],
    ["trocar de diário", () => switchDog(ctx, { dogId: id }), "profiles:update"],
    ["mudar papel de alguém", () => updateMember(ctx, { userId: other, role: "viewer" }), "dog_members:update"],
    ["remover alguém da família", () => removeMember(ctx, { userId: other }), "dog_members:delete"],
    ["sair de um diário", () => leaveDiary(ctx, { dogId: id }), "dog_members:delete"],
  ];
  for (const [name, run, op] of cases) {
    it(name, async () => {
      await expect(run()).rejects.toThrow();
      expect(m.ops).toContain(op); // chegou a tentar gravar, e o erro não foi engolido
    });
  }
});
