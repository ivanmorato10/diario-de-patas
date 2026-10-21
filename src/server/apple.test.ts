import { describe, expect, it } from "vitest";
import { appAccountTokenFor, checkAppleTransaction, uuidV5 } from "./apple";
import { APPLE_PRODUCTS, packageForAppleProduct } from "@/config/credits";

describe("compra de créditos pela Apple (app do iPhone)", () => {
  it("UUID v5 igual ao da especificação e estável por pessoa", () => {
    // Exemplo da documentação do pacote uuid: uuidv5('hello.example.com', DNS)
    expect(uuidV5("hello.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe("fdda765f-fc57-5604-a269-52a7df8164ec");
    const a = appAccountTokenFor("11111111-1111-1111-1111-111111111111");
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(appAccountTokenFor("11111111-1111-1111-1111-111111111111")).toBe(a);
    expect(appAccountTokenFor("22222222-2222-2222-2222-222222222222")).not.toBe(a);
  });
  it("produtos da Apple = os mesmos pacotes (1, 5, 10 créditos)", () => {
    expect(Object.keys(APPLE_PRODUCTS)).toEqual(["p1", "p5", "p10"]);
    expect(packageForAppleProduct("diariodepatas.credits.5")?.credits).toBe(5);
    expect(packageForAppleProduct("outro.produto")).toBeUndefined();
  });
  it("confere app, pessoa, produto e estorno antes de entregar", () => {
    const token = appAccountTokenFor("u1");
    const ok = { bundleId: "com.diariodepatas.app", appAccountToken: token, productId: "diariodepatas.credits.10", price: 4990, currency: "USD", quantity: 1 };
    const exp = { bundleId: "com.diariodepatas.app", token };
    expect(checkAppleTransaction(ok, exp)).toMatchObject({ credits: 10, amountCents: 499, currency: "USD" });
    expect(checkAppleTransaction({ ...ok, price: 27900, currency: "BRL" }, exp)).toMatchObject({ amountCents: 2790, currency: "BRL" });
    expect(checkAppleTransaction({ ...ok, quantity: 2 }, exp)).toMatchObject({ credits: 20 });
    expect(checkAppleTransaction({ ...ok, bundleId: "com.outro.app" }, exp)).toEqual({ error: "bundle" });
    expect(checkAppleTransaction({ ...ok, appAccountToken: appAccountTokenFor("u2") }, exp)).toEqual({ error: "account" });
    expect(checkAppleTransaction({ ...ok, appAccountToken: undefined }, exp)).toEqual({ error: "account" });
    expect(checkAppleTransaction({ ...ok, revocationDate: 1_700_000_000_000 }, exp)).toEqual({ error: "revoked" });
    expect(checkAppleTransaction({ ...ok, productId: "diariodepatas.credits.999" }, exp)).toEqual({ error: "product" });
  });
});
