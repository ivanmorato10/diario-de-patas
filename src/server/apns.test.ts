import { describe, expect, it } from "vitest";
import { generateKeyPairSync, verify } from "node:crypto";
import http2 from "node:http2";
import type { AddressInfo } from "node:net";
import { apnsBody, apnsJwt, postTo } from "./apns";

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

describe("envio à Apple sem erro solto (servidor HTTP/2 local)", () => {
  const payload = { title: "t", body: "b", url: "/novidades", tag: "teste" };
  async function withServer(handle: (stream: http2.ServerHttp2Stream) => void, run: (origin: string) => Promise<void>) {
    const server = http2.createServer();
    server.on("stream", (stream) => { stream.on("error", () => undefined); handle(stream as http2.ServerHttp2Stream); }); // erro do lado do servidor de teste
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); } finally { await new Promise((r) => server.close(r)); }
  }
  it("aceito (200), aparelho que não existe mais (410), resposta inválida, requisição cortada", async () => {
    await withServer((st) => { st.respond({ ":status": 200 }); st.end(); }, async (o) => {
      expect(await postTo(o, "abc", payload, "jwt")).toMatchObject({ ok: true, gone: false, status: 200 });
    });
    await withServer((st) => { st.respond({ ":status": 410 }); st.end(JSON.stringify({ reason: "Unregistered" })); }, async (o) => {
      expect(await postTo(o, "abc", payload, "jwt")).toMatchObject({ ok: false, gone: true, status: 410 });
    });
    await withServer((st) => { st.respond({ ":status": 400 }); st.end("isto não é json"); }, async (o) => {
      expect(await postTo(o, "abc", payload, "jwt")).toMatchObject({ ok: false, gone: false, reason: "invalid-response" });
    });
    await withServer((st) => { st.close(http2.constants.NGHTTP2_INTERNAL_ERROR); }, async (o) => {
      const r = await postTo(o, "abc", payload, "jwt"); // o erro da requisição vira resultado, não exceção
      expect(r.ok).toBe(false);
      expect(r.gone).toBe(false);
    });
  });
  it("servidor fora do ar: resultado de conexão, sem exceção", async () => {
    const r = await postTo("http://127.0.0.1:9", "abc", payload, "jwt");
    expect(r).toMatchObject({ ok: false, gone: false, status: 0 });
  });
});

