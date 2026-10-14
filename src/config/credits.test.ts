import { describe, expect, it } from "vitest";
import { monthReward, xpMonthOf } from "./credits";

describe("XP do mês", () => {
  it("vira o mês no fuso de Brasília, não em UTC", () => {
    expect(xpMonthOf("2026-11-01T02:00:00Z")).toBe("2026-10"); // ainda 31/10 às 23h em SP
    expect(xpMonthOf("2026-11-01T03:00:00Z")).toBe("2026-11");
  });
  it("antes e depois da meta de 200 XP", () => {
    expect(monthReward(150)).toMatchObject({ reached: false, missing: 50, pct: 75 });
    expect(monthReward(260)).toMatchObject({ reached: true, missing: 0, pct: 100 }); // excedente não conta para nada
  });
});
