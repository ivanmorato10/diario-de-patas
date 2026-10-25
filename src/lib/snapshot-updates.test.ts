/** Regressão (auditoria 23/10/2026, item 5): resultado confirmado aparece sem depender da recarga completa. */
import { describe, expect, it } from "vitest";
import { withSavedEntry, withSubmitResult } from "./snapshot-updates";
import type { Snapshot, SubmitResult } from "@/data/demo-repository";

const base = { entries: [{ id: "old", occurredDate: "2026-10-01", createdAt: "2026-10-01T10:00:00Z", missionId: null }], albumEntries: [], completions: [], xpTotal: 40, xpMonth: 10, medals: [], collectionAdvances: [] } as unknown as Snapshot;
const entry = { id: "new", occurredDate: "2026-10-20", createdAt: "2026-10-20T10:00:00Z", missionId: null } as never;
const mission = { id: "M02", collectionId: "primeiros-passos" } as never;
const result: SubmitResult = {
  submission: {} as never,
  completion: { instanceKey: "d:M02:once", dogId: "d", missionId: "M02", submissionId: "s", mode: "owner", completedAt: "2026-10-20T10:05:00Z", entryId: "new" } as never,
  xpAwarded: 60, alreadyCompleted: false, medals: ["primeiros-passos"], advancedItem: "item-1",
};

describe("resultado confirmado já na tela", () => {
  it("foto guardada entra no Diário (ordem por data) e nos álbuns escolhidos, sem duplicar ao repetir", () => {
    const s1 = withSavedEntry(base, entry, ["custom-a"]);
    expect(s1.entries.map((e) => e.id)).toEqual(["new", "old"]);
    expect(s1.albumEntries).toHaveLength(1);
    const s2 = withSavedEntry(s1, entry, ["custom-a"]);
    expect(s2.entries).toHaveLength(2);
    expect(s2.albumEntries).toHaveLength(1);
  });
  it("missão confirmada: conclusão, XP, foto ligada à missão e ao álbum, medalha e item de coleção", () => {
    const s = withSubmitResult(withSavedEntry(base, entry, []), "new", mission, result);
    expect(s.completions).toHaveLength(1);
    expect(s.xpTotal).toBe(100);
    expect(s.xpMonth).toBe(70);
    expect(s.entries.find((e) => e.id === "new")!.missionId).toBe("M02");
    expect(s.albumEntries.some((x) => String(x.albumId) === "primeiros-passos" && x.entryId === "new")).toBe(true);
    expect(s.medals.map((m) => m.setId)).toEqual(["primeiros-passos"]);
    expect(s.collectionAdvances.map((a) => a.itemId)).toEqual(["item-1"]);
    // Repetir não duplica conclusão, álbum, medalha nem item.
    const again = withSubmitResult(s, "new", mission, { ...result, xpAwarded: 0 });
    expect(again.completions).toHaveLength(1);
    expect(again.albumEntries.filter((x) => x.entryId === "new")).toHaveLength(1);
    expect(again.medals).toHaveLength(1);
    expect(again.collectionAdvances).toHaveLength(1);
  });
  it("sem conclusão (pessoa ficou em dúvida): nada muda além da foto", () => {
    const s = withSavedEntry(base, entry, []);
    expect(withSubmitResult(s, "new", mission, { ...result, completion: null })).toBe(s);
  });
});
