import { describe, expect, it } from "vitest";
import { buildIcs, RRULE } from "./ics";
import { addMonths, medNextDue, medsDue } from "@/domain/health";

describe("lembretes e frequência de remédios", () => {
  it("gera evento de dia inteiro com repetição, fim e alarme", () => {
    const ics = buildIcs({ uid: "x", title: "💊 Remédio; teste", date: "2026-10-14", rrule: RRULE.quarterly }, "2027-10-14");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261014");
    expect(ics).toContain("RRULE:FREQ=MONTHLY;INTERVAL=3;UNTIL=20271014");
    expect(ics).toContain("TRIGGER:PT9H");
    expect(ics).toContain("SUMMARY:💊 Remédio" + String.fromCharCode(92) + "; teste");
  });
  it("próxima dose: início, depois a repetição a partir da última dada", () => {
    const base = { repeat: "monthly" as const, lastGiven: null, startDate: "2026-01-31", endDate: null };
    expect(medNextDue(base)).toBe("2026-01-31");
    expect(medNextDue({ ...base, lastGiven: "2026-01-31" })).toBe("2026-02-28"); // fim do mês
    expect(medNextDue({ ...base, repeat: "weekly", lastGiven: "2026-10-07" })).toBe("2026-10-14");
    expect(medNextDue({ ...base, repeat: "" })).toBeNull();
    expect(medNextDue({ ...base, lastGiven: "2026-01-31", endDate: "2026-02-10" })).toBeNull();
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });
  it("aviso só para doses de hoje ou atrasadas", () => {
    const m = (id: string, lastGiven: string | null) => ({ id, dogId: "d", name: id, dose: "", frequency: "", repeat: "weekly" as const, lastGiven, startDate: "2026-10-01", endDate: null, notes: "", createdAt: "", updatedAt: "" });
    expect(medsDue([m("hoje", "2026-10-07"), m("depois", "2026-10-10")], "2026-10-14").map((x) => x.m.id)).toEqual(["hoje"]);
  });
});
