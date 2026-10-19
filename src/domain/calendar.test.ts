import { describe, expect, it } from "vitest";
import { easterDate, isUpcoming, orderDatePresets } from "./calendar";
import { SHOWCASE_PRESETS } from "@/config/studio";

const dates = SHOWCASE_PRESETS.filter((p) => p.category === "datas");
const ids = (region: "BR" | "US", today: string) => orderDatePresets(dates, region, today).map((p) => p.id);

describe("datas comemorativas por região", () => {
  it("Páscoa calculada por ano", () => {
    expect([2025, 2026, 2027].map(easterDate)).toEqual(["2025-04-20", "2026-04-05", "2027-03-28"]);
  });
  it("EUA: Thanksgiving e Halloween chegando vêm primeiro; datas só do Brasil vão para o fim, sem sumir", () => {
    const us = ids("US", "2026-10-18");
    expect(us.slice(0, 2)).toEqual(["halloween", "thanksgiving"]);
    expect(us.slice(-2)).toEqual(["dia-dos-animais", "festa-junina"]);
    expect(us).toHaveLength(dates.length);
  });
  it("Brasil: mantém as datas de sempre; National Dog Day e Thanksgiving ficam acessíveis no fim", () => {
    const br = ids("BR", "2026-10-18");
    expect(br[0]).toBe("halloween");
    expect(br.slice(-2)).toEqual(["national-dog-day", "thanksgiving"]);
    expect(isUpcoming({ id: "thanksgiving", region: "US" }, "BR", "2026-11-20")).toBe(false);
    expect(isUpcoming({ id: "national-dog-day", region: "US" }, "US", "2026-08-01")).toBe(true);
  });
});
