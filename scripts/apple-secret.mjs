/**
 * Gera o "Secret Key" do Entrar com Apple (JWT ES256 assinado com a chave .p8) — vale 6 meses (máximo da Apple).
 * Lê APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICES_ID e APPLE_P8_PATH do .env.local; nunca imprime o segredo.
 *   node scripts/apple-secret.mjs           → grava APPLE_SECRET no .env.local e mostra a data de validade
 * Depois: `npm run supabase:push` liga/renova no Supabase. Renovar antes de vencer (a Apple recusa segredos vencidos).
 */
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envPath = path.join(root, ".env.local");
const lines = readFileSync(envPath, "utf8").split("\n");
const env = Object.fromEntries(lines.filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const missing = ["APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_SERVICES_ID", "APPLE_P8_PATH"].filter((k) => !env[k]);
if (missing.length) {
  console.error(`Falta no .env.local: ${missing.join(", ")}`);
  process.exit(1);
}
const key = createPrivateKey(readFileSync(env.APPLE_P8_PATH.replace(/^~/, process.env.HOME), "utf8"));
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const exp = now + 180 * 24 * 3600 - 3600; // um pouco menos de 6 meses
const head = b64({ alg: "ES256", kid: env.APPLE_KEY_ID, typ: "JWT" });
const body = b64({ iss: env.APPLE_TEAM_ID, iat: now, exp, aud: "https://appleid.apple.com", sub: env.APPLE_SERVICES_ID });
const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
const jwt = `${head}.${body}.${sig}`;
const out = lines.filter((l) => !l.startsWith("APPLE_SECRET=") && !l.startsWith("APPLE_SECRET_EXPIRES="));
while (out.length && out[out.length - 1] === "") out.pop();
out.push(`APPLE_SECRET=${jwt}`, `APPLE_SECRET_EXPIRES=${new Date(exp * 1000).toISOString().slice(0, 10)}`, "");
writeFileSync(envPath, out.join("\n"));
console.log(`Segredo da Apple gerado (vale até ${new Date(exp * 1000).toLocaleDateString("pt-BR")}). Rode: npm run supabase:push`);
