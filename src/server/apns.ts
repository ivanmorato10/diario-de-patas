/**
 * Avisos no app do iPhone pelo serviço da Apple (APNs), direto do servidor (sem Firebase).
 * Autenticação por chave (.p8 "Apple Push Notifications service"): um token JWT ES256 assinado aqui, renovado a cada
 * ~50 min (a Apple aceita até 1 h). Os builds do app (TestFlight e App Store) usam o ambiente de produção; se a Apple
 * disser que o aparelho é do ambiente de testes, tenta o sandbox.
 */
import "server-only";
import http2 from "node:http2";
import { createPrivateKey, sign } from "node:crypto";
import { APPLE_BUNDLE_ID } from "./apple";

export const apnsReady = () => !!(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY);

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** JWT ES256 da APNs (assinatura no formato que a Apple espera: r||s, 64 bytes). */
export function apnsJwt(keyId: string, teamId: string, privateKeyPem: string, nowSec = Math.floor(Date.now() / 1000)) {
  const head = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const body = b64url(JSON.stringify({ iss: teamId, iat: nowSec }));
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key: createPrivateKey(privateKeyPem), dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64url(sig)}`;
}

let cached: { jwt: string; at: number } | null = null;
function currentJwt() {
  const now = Math.floor(Date.now() / 1000);
  if (!cached || now - cached.at > 50 * 60) {
    cached = { jwt: apnsJwt(process.env.APNS_KEY_ID!, process.env.APNS_TEAM_ID!, (process.env.APNS_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"), now), at: now };
  }
  return cached.jwt;
}

export interface ApnsPayload { title: string; body: string; url: string; tag: string }

/** Conteúdo do aviso: título e texto, som, agrupado pelo tag; o app abre `url` ao tocar. */
export const apnsBody = (p: ApnsPayload) => JSON.stringify({ aps: { alert: { title: p.title, body: p.body }, sound: "default", "thread-id": p.tag.slice(0, 64) }, url: p.url });

export type ApnsResult = { ok: boolean; gone: boolean; status: number; reason?: string };

/**
 * Um envio à Apple. Termina UMA vez em qualquer caso (resposta, erro da conexão, erro ou fechamento da requisição,
 * resposta inválida, tempo esgotado) e sempre libera a conexão. Nunca lança: o resultado diz o que aconteceu.
 * `origin` e `jwt` são parâmetros para os testes (servidor HTTP/2 local).
 */
export function postTo(origin: string, token: string, p: ApnsPayload, jwt: string): Promise<ApnsResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let client: http2.ClientHttp2Session | undefined;
    const finish = (r: ApnsResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { client?.close(); } catch { /* já fechada */ }
      resolve(r);
    };
    try {
      client = http2.connect(origin);
      client.on("error", () => finish({ ok: false, gone: false, status: 0, reason: "connection" }));
      const req = client.request({
        ":method": "POST", ":path": `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        "apns-topic": APPLE_BUNDLE_ID, "apns-push-type": "alert", "apns-priority": "10",
        "apns-expiration": String(Math.floor(Date.now() / 1000) + 24 * 3600),
        "apns-collapse-id": p.tag.slice(0, 64),
        "content-type": "application/json",
      });
      let status = 0, raw = "";
      timer = setTimeout(() => { try { req.close(); } catch { /* nada */ } finish({ ok: false, gone: false, status: 0, reason: "timeout" }); }, 15_000);
      req.on("error", () => finish({ ok: false, gone: false, status, reason: "request" }));
      req.on("response", (h) => { status = Number(h[":status"]) || 0; });
      req.setEncoding("utf8");
      req.on("data", (c: string) => { raw += c; });
      req.on("end", () => {
        let reason: string | undefined;
        try { reason = raw ? (JSON.parse(raw) as { reason?: string }).reason : undefined; } catch { reason = "invalid-response"; }
        finish({ ok: status === 200, gone: status === 410 || reason === "Unregistered" || reason === "BadDeviceToken", status, reason });
      });
      req.on("close", () => finish({ ok: false, gone: false, status, reason: status ? "closed" : "reset" })); // fechou sem terminar
      req.end(apnsBody(p));
    } catch {
      finish({ ok: false, gone: false, status: 0, reason: "request" });
    }
  });
}

const post = (host: string, token: string, p: ApnsPayload) => postTo(`https://${host}`, token, p, currentJwt());

/** Envia para um aparelho. `gone`: o aparelho não existe mais para a Apple (tirar da lista). */
export async function sendApns(token: string, p: ApnsPayload): Promise<ApnsResult> {
  const prod = await post("api.push.apple.com", token, p);
  if (prod.reason !== "BadDeviceToken") return prod;
  const sandbox = await post("api.sandbox.push.apple.com", token, p); // aparelho de teste (build de desenvolvimento)
  return sandbox.ok ? sandbox : { ...prod, gone: sandbox.gone };
}
