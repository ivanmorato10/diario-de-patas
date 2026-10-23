import { describe, expect, it } from "vitest";
import { generateKeyPairSync, verify } from "node:crypto";
import { apnsBody, apnsJwt } from "./apns";

describe("avisos no app do iPhone (APNs)", () => {
  it("token JWT ES256 no formato da Apple, assinatura verificável", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const jwt = apnsJwt("ABC123DEFG", "TEAM123456", pem, 1_800_000_000);
    const [h, b, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", kid: "ABC123DEFG" });
    expect(JSON.parse(Buffer.from(b, "base64url").toString())).toEqual({ iss: "TEAM123456", iat: 1_800_000_000 });
    const sig = Buffer.from(s, "base64url");
    expect(sig.length).toBe(64); // r||s, como a Apple exige (não DER)
    expect(verify("sha256", Buffer.from(`${h}.${b}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, sig)).toBe(true);
  });
  it("aviso com título, texto, som, agrupamento e a tela que abre", () => {
    const body = JSON.parse(apnsBody({ title: "Diário de Luna", body: "Paula guardou uma aventura", url: "/abrir?e=1", tag: "photo:dog:user" }));
    expect(body).toEqual({ aps: { alert: { title: "Diário de Luna", body: "Paula guardou uma aventura" }, sound: "default", "thread-id": "photo:dog:user" }, url: "/abrir?e=1" });
  });
});
