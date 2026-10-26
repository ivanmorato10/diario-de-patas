/** Chamadas do Estúdio (modo real). O prompt nunca sai daqui: só ids e opções; o servidor monta tudo. */
import type { StudioAspect } from "@/config/studio";
import { rpc } from "./real-repository";

export interface StudioJob {
  id: string;
  presetId: string;
  presetVersion: number;
  dogId?: string;
  aspect: StudioAspect;
  state: "queued" | "processing" | "succeeded" | "failed" | "cancelled";
  failureCode: string | null;
  inputEntryId: string | null;
  outputEntryId: string | null;
  outputMediaId: string | null;
  credits: number;
  overlay: StudioOverlay | null;
  /** Versão composta (nome/mensagem/moldura) já guardada como imagem da lembrança. */
  compositeMediaId?: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface StudioOverlay {
  name?: string;
  message?: string;
  frame?: "simples" | "patinhas" | "festa";
}

export interface StudioState {
  /** A pessoa autorizou enviar fotos à IA (Google Gemini), na versão atual do texto. */
  aiConsent?: boolean;
  available: boolean;
  configured: boolean;
  paused: boolean;
  balance: number;
  testCredits: boolean;
  /** Créditos de teste dados à conta (para mostrar usados × disponíveis). */
  creditsGranted?: number;
  /** Créditos já gastos em artes. */
  creditsUsed?: number;
  dailyUsed: number;
  dailyLimit: number;
  presets: { id: string; enabled: boolean; credits: number }[];
  jobs: StudioJob[];
}

export const studioState = () => rpc<StudioState>("studioState");
export const studioAiConsent = (granted: boolean) => rpc<{ aiConsent: boolean }>("studioAiConsent", { granted });
/** A tela do Estúdio e o acompanhamento geral consultam a mesma arte: uma consulta em andamento por arte. */
const jobInFlight = new Map<string, Promise<StudioJob>>();
export const studioJob = (id: string): Promise<StudioJob> => {
  const cur = jobInFlight.get(id);
  if (cur) return cur;
  const p = rpc<StudioJob>("studioJob", { id }).finally(() => jobInFlight.delete(id));
  jobInFlight.set(id, p);
  return p;
};
export const studioCreateJob = (input: {
  entryId: string; presetId: string; aspect: StudioAspect; idempotencyKey: string;
  crop: { x: number; y: number; w: number; h: number } | null; overlay: StudioOverlay | null;
}) => rpc<StudioJob>("studioCreateJob", input).then((j) => {
  if (j.state === "queued" || j.state === "processing") trackArt(j.id, j.dogId ?? null);
  return j;
});

/** Artes em andamento neste aparelho: o app inteiro acompanha (não só a tela do Estúdio), por pedido e cachorro. */
const PENDING_KEY = "ddp-art-pending";
export interface PendingArt { id: string; dogId: string | null }
export function pendingArts(): PendingArt[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]") as (string | PendingArt)[];
    return raw.map((x) => (typeof x === "string" ? { id: x, dogId: null } : x)); // formato antigo: só o id
  } catch { return []; }
}
function savePendingArts(list: PendingArt[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-10))); } catch { /* sem armazenamento: só não acompanha */ }
}
export function trackArt(id: string, dogId: string | null) {
  const list = pendingArts();
  if (!list.some((x) => x.id === id)) savePendingArts([...list, { id, dogId }]);
}
export function untrackArt(id: string) {
  savePendingArts(pendingArts().filter((x) => x.id !== id));
}

/** Problemas da foto por código (texto em studio.issues.<código>, com {dog}). */
export interface PhotoCheck { verdict: "good" | "warn" | "bad"; issues: { code: string; level: "warn" | "bad" }[]; aiChecked: boolean }
export const studioCheckPhoto = (input: { entryId: string; crop: { x: number; y: number; w: number; h: number } | null }) => rpc<PhotoCheck>("studioCheckPhoto", input);

/** Motivos de falha conhecidos (texto em studio.failures.<código>); outro código vira TECHNICAL. */
export const FAILURE_CODES = ["PROVIDER_REFUSED", "QUALITY_REJECTED", "PROVIDER_TIMEOUT", "PROVIDER_UNAVAILABLE", "NO_CREDITS", "INPUT_DELETED", "NOT_CONFIGURED", "NO_SPACE", "AI_CONSENT", "TECHNICAL"] as const;

// ---------- Compra de créditos (Pix no Brasil, cartão pelo Stripe nos EUA) ----------
export interface CreditPurchase {
  id: string; packageId: string; credits: number; amountCents: number; currency: string;
  status: "pending" | "approved" | "rejected" | "expired" | "cancelled" | "refunded";
  pixQr: string | null; pixQrBase64: string | null; expiresAt: string | null; createdAt: string; test: boolean;
  /** "stripe": pagamento na página do Stripe (checkoutUrl, enquanto pendente). */
  provider?: string; checkoutUrl?: string | null;
}
/** `currency`: moeda REAL da cobrança (BRL no Brasil, USD nos EUA), mostrada como está, sem conversão. */
export interface CreditShop { enabled: boolean; test: boolean; market: "BR" | "US"; currency: string; provider?: "mercadopago" | "stripe" | null; packages: { id: string; credits: number; priceCents: number; badge?: "best" }[]; purchases: CreditPurchase[]; /** Saldo do diário (créditos disponíveis). */ balance?: number }
export const creditShop = () => rpc<CreditShop>("creditShop");
export const createPurchase = (packageId: string, idempotencyKey: string) => rpc<CreditPurchase>("createPurchase", { packageId, idempotencyKey });
export const purchaseStatus = (id: string) => rpc<CreditPurchase>("purchaseStatus", { id });
export const fakePayPurchase = (id: string) => rpc<{ ok: boolean }>("fakePayPurchase", { id });
