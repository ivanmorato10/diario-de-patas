import { describe, expect, it } from "vitest";
import { civilDateInTz } from "./dates";
import {
  ContactSchema, MedicationSchema, VaccineSchema, addDays, daysUntil, dueStatus, isSuperseded, latestVaccines, medicationActive, upcomingCare,
  type Vaccine, type Visit,
} from "./health";

const vac = (over: Partial<Vaccine>): Vaccine => ({
  id: over.id ?? "v", dogId: "d", kind: "vaccine", name: "V10", appliedDate: "2026-01-10", nextDate: null, clinic: "", documentId: null,
  createdAt: "2026-01-10T10:00:00Z", updatedAt: "2026-01-10T10:00:00Z", ...over,
});
const visit = (over: Partial<Visit>): Visit => ({
  id: over.id ?? "c", dogId: "d", date: "2026-09-01", time: "", clinic: "", vet: "", reason: "", notes: "", nextDate: null, documentIds: [],
  createdAt: "x", updatedAt: "x", ...over,
});

describe("status de vacinas pela data (MUDANCAS-V2 §4.2)", () => {
  const today = "2026-10-12";
  it("em dia, próxima em até 30 dias e atrasada — com os limites", () => {
    expect(dueStatus(null, today)).toBe("none");
    expect(dueStatus("2026-11-12", today)).toBe("ok"); // 31 dias
    expect(dueStatus("2026-11-11", today)).toBe("soon"); // 30 dias
    expect(dueStatus(today, today)).toBe("soon"); // hoje ainda não está atrasada
    expect(dueStatus("2026-10-11", today)).toBe("overdue");
  });
  it("texto acompanha o status (não só cor)", () => {
    expect(daysUntil("2026-10-22", today)).toBe(10); // texto ("em 10 dias", "in 10 days") no teste de idiomas
    expect(daysUntil("2026-10-13", today)).toBe(1);
    expect(daysUntil("2026-10-10", today)).toBe(-2);
  });
  it("respeita o fuso do usuário na virada do dia (São Paulo × Tóquio)", () => {
    const instant = new Date("2026-10-13T01:30:00Z"); // 22h30 do dia 12 em SP; 10h30 do dia 13 em Tóquio
    const next = "2026-10-12";
    expect(dueStatus(next, civilDateInTz(instant, "America/Sao_Paulo"))).toBe("soon");
    expect(dueStatus(next, civilDateInTz(instant, "Asia/Tokyo"))).toBe("overdue");
  });
  it("atravessa a virada de mês e de ano sem erro", () => {
    expect(addDays("2026-12-25", 10)).toBe("2027-01-04");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(dueStatus("2027-01-04", "2026-12-25")).toBe("soon");
  });
  it("uma dose nova substitui a anterior: a antiga não aparece como atrasada", () => {
    const old = vac({ id: "old", appliedDate: "2025-09-01", nextDate: "2026-09-01" });
    const fresh = vac({ id: "new", name: " v10 ", appliedDate: "2026-09-05", nextDate: "2027-09-05" });
    const other = vac({ id: "verm", kind: "dewormer", name: "Vermífugo", appliedDate: "2026-07-01", nextDate: "2026-10-20" });
    expect(latestVaccines([old, fresh, other]).map((v) => v.id).sort()).toEqual(["new", "verm"]);
    expect(isSuperseded(old, [old, fresh])).toBe(true);
    const care = upcomingCare({ vaccines: [old, fresh, other], visits: [] }, "2026-10-12");
    expect(care.map((c) => c.id)).toEqual(["verm"]);
  });
});

describe("próximos cuidados (§4.6)", () => {
  it("inclui próximas em 30 dias e atrasadas, ordenadas pela data", () => {
    const care = upcomingCare(
      {
        vaccines: [vac({ id: "a", name: "A", nextDate: "2026-10-30" }), vac({ id: "b", name: "B", nextDate: "2026-10-01" }), vac({ id: "c", name: "C", nextDate: "2027-01-01" })],
        visits: [visit({ id: "v1", date: "2026-08-01", nextDate: "2026-10-15" })],
      },
      "2026-10-12",
    );
    expect(care.map((c) => [c.id, c.status])).toEqual([["b", "overdue"], ["v1", "soon"], ["a", "soon"]]);
  });
  it("consulta marcada para hoje (com horário) ou longe aparece; não duplica com o lembrete", () => {
    const care = upcomingCare({ vaccines: [], visits: [
      visit({ id: "antiga", date: "2026-09-01", nextDate: "2026-10-14" }),
      visit({ id: "hoje", date: "2026-10-14", time: "19:15", nextDate: null }),
      visit({ id: "longe", date: "2027-02-01", nextDate: null }),
    ] }, "2026-10-14");
    expect(care.map((c) => [c.id, c.visit, c.time ?? null])).toEqual([["hoje", "scheduled", "19:15"], ["longe", "scheduled", null]]);
  });
  it("só a consulta mais recente conta para a próxima consulta", () => {
    const care = upcomingCare({ vaccines: [], visits: [visit({ id: "old", date: "2026-05-01", nextDate: "2026-09-01" }), visit({ id: "new", date: "2026-09-02", nextDate: null })] }, "2026-10-12");
    expect(care).toEqual([]);
  });
});

describe("medicamentos (§4.4)", () => {
  it("em uso enquanto não tiver fim, ou até a data de fim", () => {
    expect(medicationActive({ startDate: "2026-10-01", endDate: null }, "2026-10-12")).toBe(true);
    expect(medicationActive({ startDate: "2026-10-01", endDate: "2026-10-12" }, "2026-10-12")).toBe(true);
    expect(medicationActive({ startDate: "2026-10-01", endDate: "2026-10-11" }, "2026-10-12")).toBe(false);
    expect(medicationActive({ startDate: "2026-10-13", endDate: null }, "2026-10-12")).toBe(false);
  });
});

describe("validação dos registros", () => {
  it("datas coerentes e campos obrigatórios", () => {
    expect(VaccineSchema.safeParse({ kind: "vaccine", name: "V10", appliedDate: "2026-10-01", nextDate: "2026-09-01" }).success).toBe(false);
    expect(VaccineSchema.safeParse({ kind: "vaccine", name: " ", appliedDate: "2026-10-01" }).success).toBe(false);
    expect(VaccineSchema.parse({ kind: "dewormer", name: "Verm", appliedDate: "2026-10-01" })).toMatchObject({ nextDate: null, clinic: "", documentId: null });
    expect(MedicationSchema.safeParse({ name: "X", startDate: "2026-10-10", endDate: "2026-10-01" }).success).toBe(false);
    expect(ContactSchema.safeParse({ kind: "vet", name: "Dra. Ana", phone: "abc" }).success).toBe(false);
    expect(ContactSchema.safeParse({ kind: "emergency", name: "Hospital 24h", phone: "+55 (11) 4000-0000" }).success).toBe(true);
  });
});

describe("validade de documentos (§5)", () => {
  const doc = (id: string, expiresOn: string | null) => ({ id, dogId: "d", title: id, category: "insurance" as const, docDate: null, expiresOn, notes: "", mime: "application/pdf" as const, bytes: 1, hasThumb: false, createdAt: "x", updatedAt: "x" });
  it("vence em breve (30 dias) e vencido aparecem em Próximos cuidados", () => {
    const care = upcomingCare({ vaccines: [], visits: [], documents: [doc("seguro", "2026-11-01"), doc("velho", "2026-10-01"), doc("longe", "2027-06-01"), doc("sem", null)] }, "2026-10-12");
    expect(care.map((c) => [c.id, c.kind, c.status])).toEqual([["velho", "document", "overdue"], ["seguro", "document", "soon"]]);
  });
});

