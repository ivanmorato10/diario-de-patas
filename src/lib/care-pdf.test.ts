import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildCarePdf, pdfSafe } from "./care-pdf";
import { EMPTY_HEALTH } from "@/domain/health";

describe("PDF da ficha de cuidados", () => {
  it("tira emoji e aspas tipográficas, mantém acentos", () => {
    expect(pdfSafe("Vermífugo “ok” 🐾 — ação")).toBe('Vermífugo "ok"  - ação');
  });
  it("gera um PDF válido com os dados e emoji nas anotações", async () => {
    const health = {
      ...EMPTY_HEALTH,
      weights: [{ id: "w", dogId: "d", date: "2026-10-01", kg: 7.4, createdAt: "" }],
      medications: [{ id: "m", dogId: "d", name: "Remédio 💊", dose: "1 comp.", frequency: "manhã", repeat: "monthly" as const, lastGiven: null, startDate: "2026-10-01", endDate: null, notes: "", createdAt: "", updatedAt: "" }],
    };
    const bytes = await buildCarePdf({ dogName: "Abu", birthDate: "2020-05-03", today: "2026-10-14", health });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toBe("Ficha de cuidados - Abu");
  });
});
