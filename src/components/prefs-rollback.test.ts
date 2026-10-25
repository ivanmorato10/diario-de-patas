/**
 * Regressão (auditoria 23/10/2026, itens opcionais): região/unidade com falha voltam ao último valor CONFIRMADO,
 * nunca a um toque que também não gravou, e não desfazem toque mais novo.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));
vi.mock("next-intl", () => ({ useLocale: () => "pt-BR", useTranslations: () => () => "" }));
vi.mock("@/data/store", () => ({ useStore: () => ({}) }));
vi.mock("@/data/real-repository", () => ({ rpc: async () => ({}) }));
import { beginPrefWrite, endPrefWrite } from "./locale-sync";

describe("preferência de unidade", () => {
  it("kg → lb → kg com as duas gravações falhando: a tela termina em kg (o que o servidor tem)", () => {
    const a = beginPrefWrite("u1", { weightUnit: "kg" }, { weightUnit: "lb" });   // tela: lb
    const b = beginPrefWrite("u1", { weightUnit: "lb" }, { weightUnit: "kg" });   // tela: kg (lb ainda sem resposta)
    expect(endPrefWrite(a, { weightUnit: "lb" }, false)).toEqual({});            // há toque mais novo: não mexe
    expect(endPrefWrite(b, { weightUnit: "kg" }, false)).toEqual({ weightUnit: "kg" }); // antes voltava para lb
  });
  it("1ª grava e 2ª falha: volta para o que a 1ª gravou", () => {
    const a = beginPrefWrite("u1", { weightUnit: "kg" }, { weightUnit: "lb" });
    const b = beginPrefWrite("u1", { weightUnit: "lb" }, { weightUnit: "kg" });
    expect(endPrefWrite(a, { weightUnit: "lb" }, true)).toEqual({});
    expect(endPrefWrite(b, { weightUnit: "kg" }, false)).toEqual({ weightUnit: "lb" });
  });
  it("região e unidade são independentes", () => {
    const a = beginPrefWrite("u1", { region: "BR", weightUnit: "kg" }, { region: "US" });
    const b = beginPrefWrite("u1", { region: "US", weightUnit: "kg" }, { weightUnit: "lb" });
    expect(endPrefWrite(a, { region: "US" }, false)).toEqual({ region: "BR" });
    expect(endPrefWrite(b, { weightUnit: "lb" }, true)).toEqual({});
  });
});
