import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { mapMpStatus, validMpSignature } from "./payments";
import { CREDIT_PACKAGES, formatBRL } from "@/config/credits";

describe("compra de créditos (Pix)", () => {
  it("pacotes aprovados: 1 por R$ 1,00, 5 por R$ 4,00, 10 por R$ 7,00", () => {
    expect(CREDIT_PACKAGES.map((p) => [p.credits, formatBRL(p.priceCents)])).toEqual([[1, "R$ 1,00"], [5, "R$ 4,00"], [10, "R$ 7,00"]].map(([c, v]) => [c, String(v).replace(" ", " ")]));
  });
  it("traduz o status do Mercado Pago", () => {
    expect(mapMpStatus("approved")).toBe("approved");
    expect(mapMpStatus("in_process")).toBe("pending");
    expect(mapMpStatus("charged_back")).toBe("refunded");
    expect(mapMpStatus(undefined)).toBe("pending");
  });
  it("valida a assinatura do webhook e recusa a falsa", () => {
    const secret = "segredo", ts = "1700000000", rid = "req-1", id = "123456";
    const v1 = createHmac("sha256", secret).update(`id:${id};request-id:${rid};ts:${ts};`).digest("hex");
    expect(validMpSignature(secret, `ts=${ts},v1=${v1}`, rid, id)).toBe(true);
    expect(validMpSignature(secret, `ts=${ts},v1=${"0".repeat(64)}`, rid, id)).toBe(false);
    expect(validMpSignature(secret, `ts=${ts},v1=${v1}`, rid, "999")).toBe(false);
    expect(validMpSignature(secret, null, rid, id)).toBe(false);
  });
});

import { purchaseConfirmedEmail } from "@/lib/email-templates";
describe("email de pagamento confirmado", () => {
  it("traz créditos, valor, diário e protege o nome do cachorro", () => {
    const m = purchaseConfirmedEmail({ dogName: "Pepe <b>", credits: 5, amount: "R$ 4,00", paidAt: "18 de outubro", balance: 7, reference: "a1b2c3d4-x" });
    expect(m.subject).toContain("+5 créditos");
    expect(m.html).toContain("R$ 4,00");
    expect(m.html).toContain("A1B2C3D4");
    expect(m.html).toContain("Pepe &lt;b&gt;");
    expect(m.html).not.toContain("Pepe <b>");
  });
});
