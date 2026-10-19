import { describe, expect, it } from "vitest";
import { civilDateInTz, isCivilDate, monthKey } from "./dates";
import { formatCivilDate } from "@/i18n/format";
import { dailySuggestions, levelFor, missionState, totalCatalogXp, missionById } from "./missions";
import { decideStatus } from "./validation";
import { computeBalance, consume, release, reserve, CreditError, type CreditEntry } from "./credits";
import { LEVELS, MISSIONS } from "@/config/catalog";

const allPrefs = { home: true, outdoor: true, socialDogs: true, people: true };

describe("datas civis (§12)", () => {
  it("não muda de dia ao usar fuso", () => {
    // 01:30 UTC de 15/03 ainda é 14/03 em São Paulo
    expect(civilDateInTz(new Date("2026-03-15T01:30:00Z"), "America/Sao_Paulo")).toBe("2026-03-14");
    expect(civilDateInTz(new Date("2026-03-15T01:30:00Z"), "Asia/Tokyo")).toBe("2026-03-15");
  });
  it("formata sem conversão para UTC", () => {
    expect(formatCivilDate("2026-01-01", "pt-BR")).toBe("1 de janeiro de 2026");
    expect(formatCivilDate("2026-01-01", "en")).toBe("January 1, 2026");
    expect(monthKey("2026-01-31")).toBe("2026-01");
  });
  it("valida datas", () => {
    expect(isCivilDate("2026-02-29")).toBe(false);
    expect(isCivilDate("2028-02-29")).toBe(true);
    expect(isCivilDate("2026-13-01")).toBe(false);
  });
});

describe("missões (§9)", () => {
  it("só M01 começa disponível", () => {
    const empty = new Set<string>();
    expect(MISSIONS.filter((m) => missionState(m, empty) === "available").map((m) => m.id)).toEqual(["M01"]);
  });
  it("concluir M01 abre as demais", () => {
    const done = new Set(["M01"]);
    expect(MISSIONS.filter((m) => missionState(m, done) === "available")).toHaveLength(MISSIONS.length - 1);
  });
  it("sugere até 3 respeitando preferências sociais", () => {
    const s = dailySuggestions(new Set(["M01"]), { ...allPrefs, socialDogs: false }, "2026-10-12");
    expect(s.length).toBeLessThanOrEqual(3);
    expect(s.some((m) => m.context === "social-dogs")).toBe(false);
  });
  it("trocar sugestão muda a lista de forma determinística", () => {
    const a = dailySuggestions(new Set(["M01"]), allPrefs, "2026-10-12", 0).map((m) => m.id);
    const b = dailySuggestions(new Set(["M01"]), allPrefs, "2026-10-12", 1).map((m) => m.id);
    expect(a).not.toEqual(b);
    expect(dailySuggestions(new Set(["M01"]), allPrefs, "2026-10-12", 0).map((m) => m.id)).toEqual(a);
  });
  it("nunca trava: sem preferências cai para missões de casa/qualquer lugar", () => {
    const s = dailySuggestions(new Set(["M01"]), { home: false, outdoor: false, socialDogs: false, people: false }, "2026-10-12");
    expect(s.length).toBeGreaterThan(0);
  });
  it("níveis anunciados são alcançáveis pelo catálogo", () => {
    expect(totalCatalogXp()).toBeGreaterThanOrEqual(LEVELS[LEVELS.length - 1].minXp);
    expect(levelFor(0).level).toBe(0);
    expect(levelFor(75).level).toBe(2);
    expect(levelFor(349).level).toBe(4);
    expect(levelFor(500).level).toBe(6);
  });
});

describe("catálogo v2 (MUDANCAS-V2 §3)", () => {
  it("48 missões, 650 XP, ids e slugs únicos", () => {
    expect(MISSIONS).toHaveLength(48);
    expect(totalCatalogXp()).toBe(650);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(48);
    expect(new Set(MISSIONS.map((m) => m.slug)).size).toBe(48);
  });
  it("todas as novas pedem só M01; missões opcionais nunca são pré-requisito", () => {
    expect(MISSIONS.filter((m) => m.id !== "M01").every((m) => m.prerequisiteId === "M01")).toBe(true);
    const optional = new Set(MISSIONS.filter((m) => m.optional).map((m) => m.id));
    expect(optional.size).toBeGreaterThan(0);
    expect(MISSIONS.some((m) => m.prerequisiteId && optional.has(m.prerequisiteId))).toBe(false);
  });
  it("toda missão externa tem uma alternativa em casa", () => {
    const outdoor = MISSIONS.filter((m) => m.context === "outdoor");
    expect(outdoor.length).toBeGreaterThan(0);
    expect(outdoor.every((m) => m.homeAlternative === true)).toBe(true); // texto em catalog.missions.<id>.homeAlternative (teste de idiomas)
  });
  it("níveis em ordem crescente", () => {
    expect(LEVELS.map((l) => l.minXp)).toEqual([0, 30, 70, 120, 220, 350, 500]);
  });
});

describe("regras do validador (§10)", () => {
  const ok = { decision: "approved", dog_visible: true, reason_code: "MATCH", user_message: "ok", model_version: "x" };
  it("saída inválida é falha técnica, não reprovação", () => {
    expect(decideStatus(missionById("M03")!, { decision: "yes" }).status).toBe("technical_failure");
  });
  it("aprovado sem cachorro visível vira incerto", () => {
    expect(decideStatus(missionById("M03")!, { ...ok, dog_visible: false }).status).toBe("uncertain");
  });
  it("missão subjetiva não é reprovada pelo humor", () => {
    expect(decideStatus(missionById("M10")!, { ...ok, decision: "not_matched", reason_code: "SUBJECTIVE_CRITERION" }).status).toBe("approved");
  });
});

describe("ledger de créditos (§11)", () => {
  const grant: CreditEntry = { idempotencyKey: "grant:1", jobId: null, op: "grant", amount: 1 };
  it("reserva, consome e não fica negativo", () => {
    let l: CreditEntry[] = [grant];
    l = [...l, ...reserve(l, "j1", 1)];
    expect(computeBalance(l)).toEqual({ available: 0, reserved: 1 });
    expect(() => reserve(l, "j2", 1)).toThrow(CreditError);
    l = [...l, ...consume(l, "j1")];
    expect(computeBalance(l)).toEqual({ available: 0, reserved: 0 });
  });
  it("reserva repetida é idempotente e falha libera", () => {
    let l: CreditEntry[] = [grant];
    l = [...l, ...reserve(l, "j1", 1)];
    expect(reserve(l, "j1", 1)).toEqual([]);
    l = [...l, ...release(l, "j1")];
    expect(computeBalance(l).available).toBe(1);
    expect(() => consume(l, "j1")).toThrow(CreditError);
  });
});
