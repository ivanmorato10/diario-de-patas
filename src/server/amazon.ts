/**
 * Amazon Creators API (substituta da PA-API 5): foto e título oficiais dos Achadinhos.
 * Login with Amazon (credencial versão 3.x, NA): token client_credentials, válido 1 h (guardado ~55 min).
 * Dados guardados no máximo 24 h, como mandam as regras; imagem sempre servida pela própria Amazon.
 * Conta sem vendas recentes → "AssociateNotEligible": devolvemos vazio e a página mostra as ilustrações.
 */
import "server-only";
import { ACHADINHOS, AMAZON_TAG } from "@/config/achadinhos";

export interface AmazonItemInfo { title: string | null; image: string | null }

let token: { value: string; until: number } | null = null;
let cache: { at: number; items: Record<string, AmazonItemInfo>; status: string } | null = null;
const DAY = 24 * 3600_000;

async function getToken() {
  if (token && token.until > Date.now()) return token.value;
  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: process.env.AMAZON_CREATORS_CREDENTIAL_ID, client_secret: process.env.AMAZON_CREATORS_CREDENTIAL_SECRET, scope: "creatorsapi::default" }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!res.ok || !json?.access_token) throw new Error(`token ${res.status}`);
  token = { value: json.access_token, until: Date.now() + Math.min(55 * 60_000, (json.expires_in ?? 3600) * 900) };
  return token.value;
}

/** Busca (ou devolve do cache de até 24 h) título e imagem dos produtos da lista. */
export async function achadinhosInfo(): Promise<{ status: string; items: Record<string, AmazonItemInfo> }> {
  if (!process.env.AMAZON_CREATORS_CREDENTIAL_ID || !process.env.AMAZON_CREATORS_CREDENTIAL_SECRET) return { status: "not_configured", items: {} };
  // Conta não elegível: tenta de novo a cada 6 h, sem martelar a API.
  if (cache && Date.now() - cache.at < (cache.status === "ok" ? DAY : 6 * 3600_000)) return { status: cache.status, items: cache.items };
  const items: Record<string, AmazonItemInfo> = {};
  let status = "ok";
  try {
    const asins = ACHADINHOS.map((a) => a.asin);
    for (let i = 0; i < asins.length; i += 10) {
      const res = await fetch("https://creatorsapi.amazon/catalog/v1/getItems", {
        method: "POST",
        headers: { authorization: `Bearer ${await getToken()}`, "content-type": "application/json", "x-marketplace": "www.amazon.com" },
        body: JSON.stringify({ itemIds: asins.slice(i, i + 10), itemIdType: "ASIN", marketplace: "www.amazon.com", partnerTag: process.env.AMAZON_PARTNER_TAG || AMAZON_TAG, resources: ["itemInfo.title", "images.primary.large"] }),
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) { status = json?.reason ?? `http_${res.status}`; break; }
      for (const it of json?.itemsResult?.items ?? json?.items ?? []) {
        items[it.asin ?? it.ASIN] = { title: it.itemInfo?.title?.displayValue ?? null, image: it.images?.primary?.large?.url ?? null };
      }
    }
  } catch (e) {
    status = "error";
    console.error("amazon creators", e instanceof Error ? e.message : e);
  }
  cache = { at: Date.now(), items, status };
  return { status, items };
}
