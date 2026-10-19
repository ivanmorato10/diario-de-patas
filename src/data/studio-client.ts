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
  createdAt: string;
  finishedAt: string | null;
}

export interface StudioOverlay {
  name?: string;
  message?: string;
  frame?: "simples" | "patinhas" | "festa";
}

export interface StudioState {
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
export const studioJob = (id: string) => rpc<StudioJob>("studioJob", { id });
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
export const FAILURE_CODES = ["PROVIDER_REFUSED", "QUALITY_REJECTED", "PROVIDER_TIMEOUT", "PROVIDER_UNAVAILABLE", "NO_CREDITS", "INPUT_DELETED", "NOT_CONFIGURED", "NO_SPACE", "TECHNICAL"] as const;

// ---------- Compra de créditos (Pix) ----------
export interface CreditPurchase {
  id: string; packageId: string; credits: number; amountCents: number; currency: string;
  status: "pending" | "approved" | "rejected" | "expired" | "cancelled" | "refunded";
  pixQr: string | null; pixQrBase64: string | null; expiresAt: string | null; createdAt: string; test: boolean;
}
/** `currency`: moeda REAL da cobrança (hoje BRL), mostrada como está, sem conversão. */
export interface CreditShop { enabled: boolean; test: boolean; market: string; currency: string; packages: { id: string; credits: number; priceCents: number; badge?: "best" }[]; purchases: CreditPurchase[] }
export const creditShop = () => rpc<CreditShop>("creditShop");
export const createPurchase = (packageId: string, idempotencyKey: string) => rpc<CreditPurchase>("createPurchase", { packageId, idempotencyKey });
export const purchaseStatus = (id: string) => rpc<CreditPurchase>("purchaseStatus", { id });
export const fakePayPurchase = (id: string) => rpc<{ ok: boolean }>("fakePayPurchase", { id });
