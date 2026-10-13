import { describe, expect, it } from "vitest";
import { COLLECTION_ITEMS, DAILY_MISSIONS, DAILY_NO_REPEAT_DAYS, PERMANENT_SETS, SPECIAL_MISSIONS } from "@/config/cycle";
import { civilDateInTz } from "./dates";
import { addDays } from "./health";
import { ALL_MISSIONS, activeSpecials, buildHistory, eligibleDaily, generatePlan, instanceKey, setProgress, swapInPlan, type DailyPlan } from "./cycle";
import { levelFor, missionById } from "./missions";

const all = { home: true, outdoor: true, socialDogs: true, people: true };

/** Simula N dias abrindo o app uma vez por dia (plano gravado e usado como histórico). */
function simulate(days: number, prefs = all, start = "2026-10-01", dog = "dog-1") {
  const plans: DailyPlan[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    plans.push(generatePlan(dog, date, prefs, buildHistory(plans, [], date), "x"));
  }
  return plans;
}

describe("catálogo do ciclo (§7.4–7.6)", () => {
  it("66 missões do dia (22 por espaço), 5 coleções de 6, 3 especiais; IDs e slugs únicos", () => {
    expect(DAILY_MISSIONS).toHaveLength(66);
    for (const s of ["A", "B", "C"]) expect(DAILY_MISSIONS.filter((m) => m.slot === s)).toHaveLength(22);
    expect(PERMANENT_SETS).toHaveLength(5);
    expect(PERMANENT_SETS.every((s) => s.items.length === 6 && s.items.every((id) => missionById(id)))).toBe(true);
    expect(SPECIAL_MISSIONS).toHaveLength(3);
    expect(new Set(ALL_MISSIONS.map((m) => m.id)).size).toBe(ALL_MISSIONS.length);
    expect(new Set(ALL_MISSIONS.map((m) => m.slug)).size).toBe(ALL_MISSIONS.length);
  });
  it("itens reaproveitam IDs existentes e cada missão do dia ligada aponta para um item de coleção", () => {
    const items = new Set(PERMANENT_SETS.flatMap((s) => s.items));
    expect(["M17", "M30", "M24", "M03"].every((id) => items.has(id))).toBe(true);
    expect(COLLECTION_ITEMS.every((c) => items.has(c.id))).toBe(true);
    expect(DAILY_MISSIONS.filter((m) => m.advancesItem).every((m) => items.has(m.advancesItem!))).toBe(true);
  });
});

describe("sorteio das missões do dia (§7.1)", () => {
  it("mesmo dia e mesmo cachorro → mesmas 3 sugestões; uma por espaço", () => {
    const a = generatePlan("dog-1", "2026-10-12", all, new Map(), "x");
    const b = generatePlan("dog-1", "2026-10-12", all, new Map(), "y");
    expect(a.slots).toEqual(b.slots);
    expect(missionById(a.slots.A)?.slot).toBe("A");
    expect(missionById(a.slots.B)?.slot).toBe("B");
    expect(missionById(a.slots.C)?.slot).toBe("C");
  });
  it("muda na virada do dia no fuso do usuário (São Paulo × Tóquio)", () => {
    const instant = new Date("2026-10-13T01:30:00Z");
    const sp = civilDateInTz(instant, "America/Sao_Paulo"); // 12/10
    const tk = civilDateInTz(instant, "Asia/Tokyo"); // 13/10
    expect([sp, tk]).toEqual(["2026-10-12", "2026-10-13"]);
    const planSp = generatePlan("dog-1", sp, all, new Map(), "x");
    // No dia seguinte o histórico inclui o plano anterior: nenhuma das 3 pode voltar.
    const planTk = generatePlan("dog-1", tk, all, buildHistory([planSp], [], tk), "x");
    for (const s of ["A", "B", "C"] as const) expect(planTk.slots[s]).not.toBe(planSp.slots[s]);
  });
  it("nada se repete em 14 dias enquanto o espaço tiver opção; esgotado, volta a mais antiga", () => {
    const plans = simulate(30);
    for (const slot of ["A", "B", "C"] as const) {
      const pool = eligibleDaily(slot, all).length; // 22
      const seq = plans.map((p) => p.slots[slot]);
      for (let i = 0; i < seq.length; i++) {
        const prev = i > 0 ? seq.lastIndexOf(seq[i], i - 1) : -1;
        if (prev >= 0) expect(i - prev).toBeGreaterThanOrEqual(Math.min(pool, DAILY_NO_REPEAT_DAYS));
      }
      const win = Math.min(pool, DAILY_NO_REPEAT_DAYS);
      expect(pool).toBeGreaterThanOrEqual(15); // banco suficiente para 14 dias sem repetir
      expect(new Set(seq.slice(0, win)).size).toBe(win); // os 14 primeiros dias, todos diferentes
    }
  });
  it("respeita as preferências: sem passeio o espaço C vira retrato; sem outros cães, sem encontro na rua", () => {
    const noWalk = { ...all, outdoor: false };
    expect(eligibleDaily("C", noWalk).every((m) => m.portrait)).toBe(true);
    expect(simulate(20, noWalk).every((p) => missionById(p.slots.C)?.portrait)).toBe(true);
    expect(eligibleDaily("C", { ...all, socialDogs: false }).some((m) => m.id === "D31")).toBe(false);
    expect(eligibleDaily("B", { ...all, people: false }).every((m) => m.context !== "people")).toBe(true);
  });
  it("trocar dá outra missão do mesmo espaço, sem devolver as que já saíram hoje", () => {
    let p = generatePlan("dog-1", "2026-10-12", all, new Map(), "x");
    const seen = [p.slots.B];
    for (let i = 0; i < 5; i++) {
      p = swapInPlan(p, "B", all, new Map());
      expect(missionById(p.slots.B)?.slot).toBe("B");
      expect(seen).not.toContain(p.slots.B);
      seen.push(p.slots.B);
    }
    expect(p.swaps.B).toBe(5);
    expect(p.slots.A).toBe(generatePlan("dog-1", "2026-10-12", all, new Map(), "x").slots.A);
  });
  it("missão do dia rende XP por dia sorteado; única e item de coleção, uma vez para sempre", () => {
    const d = missionById("D02")!, m = missionById("M24")!, s = missionById("S02")!;
    expect(instanceKey("dog", d, "2026-10-12")).not.toBe(instanceKey("dog", d, "2026-10-13"));
    expect(instanceKey("dog", m, "2026-10-12")).toBe(instanceKey("dog", m, "2027-01-01"));
    expect(instanceKey("dog", s, "2026-12-10", "2026")).not.toBe(instanceKey("dog", s, "2027-12-10", "2027"));
  });
});

describe("especiais (§7.6)", () => {
  const ids = (today: string, birth: string | null = null) => activeSpecials(today, birth, "Luna").map((w) => `${w.mission.id}:${w.occurrence}`);
  it("só aparecem dentro da janela", () => {
    expect(ids("2026-10-23")).toEqual([]);
    expect(ids("2026-10-24")).toEqual(["S03:2026"]);
    expect(ids("2026-10-31")).toEqual(["S03:2026"]);
    expect(ids("2026-11-01")).toEqual([]);
    expect(ids("2026-12-01")).toEqual(["S02:2026"]);
    expect(ids("2026-12-27")).toEqual([]);
  });
  it("aniversário: 7 dias antes até 7 depois, só com data informada, uma vez por ano", () => {
    expect(ids("2026-03-08", null)).toEqual([]);
    expect(ids("2026-03-08", "2022-03-15")).toEqual(["S01:2026"]);
    expect(ids("2026-03-22", "2022-03-15")).toEqual(["S01:2026"]);
    expect(ids("2026-03-23", "2022-03-15")).toEqual([]);
    expect(ids("2027-01-03", "2020-12-30")).toEqual(["S01:2026"]); // janela atravessa o ano
    expect(ids("2027-02-28", "2024-02-29")).toEqual(["S01:2027"]); // 29/02 em ano não bissexto
    expect(activeSpecials("2026-03-15", "2022-03-15", "Luna")[0].title).toBe("Aniversário de Luna");
  });
});

describe("coleções permanentes (§7.5)", () => {
  it("item concluído antes desta mudança (M24) conta automaticamente", () => {
    const p = setProgress([{ missionId: "M24", instanceKey: "dog:M24", entryId: "e1" }], []);
    const nos = p.find((x) => x.set.id === "nos-dois")!;
    expect(nos.done).toBe(1);
    expect(nos.items.find((i) => i.missionId === "M24")).toMatchObject({ done: true, entryId: "e1" });
  });
  it("avanço por missão do dia conta e completa a coleção com os 6", () => {
    const set = PERMANENT_SETS.find((s) => s.id === "brinquedos-e-manias")!;
    const p = setProgress(set.items.slice(0, 5).map((id) => ({ missionId: id, instanceKey: `dog:${id}` })), [{ itemId: set.items[5], entryId: "e9" }]);
    expect(p.find((x) => x.set.id === set.id)?.complete).toBe(true);
  });
});

describe("níveis sem fim (§7.3)", () => {
  it("depois de “Sempre juntos”, II, III… a cada 250 XP", () => {
    expect(levelFor(499).title).toBe("Melhores amigos");
    expect(levelFor(500)).toMatchObject({ title: "Sempre juntos", nextTitle: "Sempre juntos II", nextAt: 750 });
    expect(levelFor(760)).toMatchObject({ title: "Sempre juntos II", nextAt: 1000 });
    expect(levelFor(1000).title).toBe("Sempre juntos III");
  });
});
