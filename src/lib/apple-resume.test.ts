/**
 * Regressão (revisão 25/10/2026, B1): a recuperação de compras não filtra pelo identificador (maiúsculas do Swift
 * excluíam tudo) e só finaliza na Apple DEPOIS de o servidor confirmar.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ calls: [] as string[], filter: undefined as any, confirmFails: false }));
vi.mock("./native", () => ({ isNativeApp: () => true }));
vi.mock("@/data/demo-repository", () => ({ DomainError: class extends Error {} }));
vi.mock("@/data/real-repository", () => ({
  getActiveDog: () => "abu",
  rpc: async (method: string) => {
    m.calls.push(method);
    if (method === "appleStore") return { enabled: true, products: { p5: "credits5" } };
    if (method === "appleConfirm" && m.confirmFails) throw new Error("rede");
    return { status: "approved" };
  },
}));
vi.mock("@capgo/native-purchases", () => ({
  NativePurchases: {
    getPurchases: async (a: any) => { m.filter = a?.appAccountToken; return { purchases: [{ productIdentifier: "credits5", transactionId: "123" }, { productIdentifier: "outro", transactionId: "9" }] }; },
    acknowledgePurchase: async () => { m.calls.push("finish"); },
  },
}));
import { resumeApplePurchases } from "./apple-iap";

beforeEach(() => { m.calls = []; m.filter = undefined; m.confirmFails = false; });

describe("recuperação de compras da Apple", () => {
  it("lista sem filtro de identificador, confirma no servidor e só então finaliza", async () => {
    await resumeApplePurchases();
    expect(m.filter).toBeUndefined();
    expect(m.calls).toEqual(["appleStore", "appleConfirm", "finish"]);
  });
  it("servidor falhou: NÃO finaliza (a compra continua aberta para a próxima tentativa)", async () => {
    m.confirmFails = true;
    await resumeApplePurchases();
    expect(m.calls).toEqual(["appleStore", "appleConfirm"]);
  });
});

describe("plugin corrigido (scripts/patch-native-purchases.mjs)", () => {
  it("o aviso da Apple não finaliza a transação e o filtro ignora maiúsculas/minúsculas", async () => {
    const { readFileSync } = await import("node:fs");
    const dir = "node_modules/@capgo/native-purchases/ios/Sources/NativePurchasesPlugin";
    const plugin = readFileSync(`${dir}/NativePurchasesPlugin.swift`, "utf8");
    const listener = plugin.slice(plugin.indexOf("startTransactionUpdatesListener() {"), plugin.indexOf("isBillingSupported"));
    expect(listener).not.toContain("transaction.finish()");
    expect(readFileSync(`${dir}/TransactionHelpers.swift`, "utf8")).toContain("uuidString.lowercased() != filter.lowercased()");
  });
});
