import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { mapMpStatus, mapStripeSession, validMpSignature, validStripeSignature } from "./payments";
import { CREDIT_MARKETS, CREDIT_PACKAGES, packageById } from "@/config/credits";
import { formatMoney } from "@/i18n/format";

describe("compra de créditos (Pix)", () => {
  it("pacotes aprovados: 1 por R$ 1,00, 5 por R$ 4,00, 10 por R$ 7,00", () => {
    expect(CREDIT_PACKAGES.map((p) => [p.credits, formatMoney(p.priceCents, "BRL", "pt-BR")])).toEqual([[1, "R$ 1,00"], [5, "R$ 4,00"], [10, "R$ 7,00"]].map(([c, v]) => [c, String(v).replace(" ", " ")]));
    // Em inglês continua sendo cobrança em reais: valor igual, moeda explícita (nada de conversão para dólar).
    expect(formatMoney(400, "BRL", "en")).toBe("R$4.00 (BRL)");
    // Mercado dos EUA: dólar pelo Stripe, preços fixos aprovados (nada de conversão do real).
    expect(CREDIT_MARKETS.US).toMatchObject({ currency: "USD", provider: "stripe" });
    expect(CREDIT_MARKETS.US.packages.map((p) => [p.credits, formatMoney(p.priceCents, "USD", "en")])).toEqual([[1, "$0.99"], [5, "$3.99"], [10, "$6.99"]]);
    expect(packageById("p5", "US")?.priceCents).toBe(399);
    expect(packageById("p5", "BR")?.priceCents).toBe(400);
    expect(packageById("p99", "US")).toBeUndefined();
  });
  it("traduz a sessão do Stripe (pago, vencido, estornado, contestado)", () => {
    expect(mapStripeSession({ status: "complete", payment_status: "paid", payment_intent: { latest_charge: { amount_refunded: 0 } } })).toBe("approved");
    expect(mapStripeSession({ status: "complete", payment_status: "paid", payment_intent: "pi_123" })).toBe("approved");
    expect(mapStripeSession({ status: "open", payment_status: "unpaid" })).toBe("pending");
    expect(mapStripeSession({ status: "expired", payment_status: "unpaid" })).toBe("expired");
    expect(mapStripeSession({ status: "complete", payment_status: "paid", payment_intent: { latest_charge: { amount_refunded: 399, refunded: true } } })).toBe("refunded");
    expect(mapStripeSession({ status: "complete", payment_status: "paid", payment_intent: { latest_charge: { amount_refunded: 0, disputed: true } } })).toBe("refunded");
  });
  it("valida a assinatura do aviso do Stripe e recusa a falsa ou velha", () => {
    const secret = "whsec_teste", body = '{"id":"evt_1"}', now = 1_800_000_000, t = String(now - 10);
    const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    expect(validStripeSignature(secret, `t=${t},v1=${v1}`, body, now)).toBe(true);
    expect(validStripeSignature(secret, `t=${t},v1=${"0".repeat(64)},v1=${v1}`, body, now)).toBe(true); // várias assinaturas: vale uma
    expect(validStripeSignature(secret, `t=${t},v1=${v1}`, body + " ", now)).toBe(false); // corpo alterado
    expect(validStripeSignature(secret, `t=${t},v1=${v1}`, body, now + 600)).toBe(false); // aviso de mais de 5 min
    expect(validStripeSignature("whsec_outro", `t=${t},v1=${v1}`, body, now)).toBe(false);
    expect(validStripeSignature(secret, null, body, now)).toBe(false);
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
    const en = purchaseConfirmedEmail({ dogName: "Pepe", credits: 1, amount: "R$1.00 (BRL)", paidAt: "October 18, 2026", balance: 1, reference: "a1b2c3d4-x" }, "en");
    expect(en.subject).toBe("Payment confirmed: +1 credit for Pepe 🐾");
    expect(en.html).toContain("R$1.00 (BRL)");
  });
});
