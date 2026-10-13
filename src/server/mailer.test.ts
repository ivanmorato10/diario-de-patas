import { describe, expect, it } from "vitest";
import { isTestAddress } from "./mailer";

describe("email do app", () => {
  it("nunca envia para domínios de teste", () => {
    expect(isTestAddress("e2e-a-123@diariodepatas.test")).toBe(true);
    expect(isTestAddress("x@foo.example")).toBe(true);
    expect(isTestAddress("x@example.com")).toBe(true);
    expect(isTestAddress("voce@gmail.com")).toBe(false);
    expect(isTestAddress("voce@icloud.com")).toBe(false);
  });
});
