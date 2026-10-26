/**
 * Regressão (26/10/2026): ao completar as 200 patinhas, o saldo do Estúdio guardado no aparelho sobe junto (o
 * crédito aparece de uma vez, sem sair e entrar) e a comemoração aparece uma vez por cachorro e mês.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => () => "" }));
vi.mock("@/components/brand", () => ({ AbuMascot: () => null }));
import { bumpCachedBalance, celebrationSeen, markCelebrationSeen } from "./credit-celebration";

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
});

describe("crédito das 200 patinhas", () => {
  it("o saldo guardado do Estúdio sobe junto (abre já com o crédito novo)", () => {
    mem.set("ddp-studio-abu", JSON.stringify({ balance: 2, available: true }));
    bumpCachedBalance("abu", 1);
    expect(JSON.parse(mem.get("ddp-studio-abu")!)).toMatchObject({ balance: 3, available: true });
    bumpCachedBalance("pepe", 1); // sem cópia guardada: nada a mexer (o servidor manda o saldo)
    expect(mem.has("ddp-studio-pepe")).toBe(false);
  });
  it("comemora uma vez por cachorro e mês", () => {
    expect(celebrationSeen("abu", "2026-10")).toBe(false);
    markCelebrationSeen("abu", "2026-10");
    expect(celebrationSeen("abu", "2026-10")).toBe(true);
    expect(celebrationSeen("abu", "2026-11")).toBe(false);
    expect(celebrationSeen("pepe", "2026-10")).toBe(false);
  });
});
