/** Chamadas do Estúdio (modo real). O prompt nunca sai daqui: só ids e opções; o servidor monta tudo. */
import type { StudioAspect } from "@/config/studio";
import { rpc } from "./real-repository";

export interface StudioJob {
  id: string;
  presetId: string;
  presetVersion: number;
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
  if (j.state === "queued" || j.state === "processing") trackArt(j.id);
  return j;
});

/** Artes em andamento neste aparelho: o app inteiro acompanha (não só a tela do Estúdio). */
const PENDING_KEY = "ddp-art-pending";
export function pendingArts(): string[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]") as string[]; } catch { return []; }
}
function savePendingArts(ids: string[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(ids.slice(-10))); } catch { /* sem armazenamento: só não acompanha */ }
}
export function trackArt(id: string) {
  const ids = pendingArts();
  if (!ids.includes(id)) savePendingArts([...ids, id]);
}
export function untrackArt(id: string) {
  savePendingArts(pendingArts().filter((x) => x !== id));
}

export interface PhotoCheck { verdict: "good" | "warn" | "bad"; issues: { code: string; level: "warn" | "bad"; message: string }[]; aiChecked: boolean }
export const studioCheckPhoto = (input: { entryId: string; crop: { x: number; y: number; w: number; h: number } | null }) => rpc<PhotoCheck>("studioCheckPhoto", input);

export const FAILURE_PT: Record<string, string> = {
  PROVIDER_REFUSED: "Não consegui usar esta foto. Tente outra em que {dog} apareça sozinho. O crédito foi devolvido.",
  QUALITY_REJECTED: "A arte não ficou boa o bastante ({dog} não apareceu direito). O crédito foi devolvido.",
  PROVIDER_TIMEOUT: "A arte demorou demais e foi cancelada. O crédito foi devolvido.",
  PROVIDER_UNAVAILABLE: "O serviço de artes está instável agora. O crédito foi devolvido — tente mais tarde.",
  NO_CREDITS: "Os créditos acabaram por enquanto. Dá para criar mais em Créditos, ou ganhar 1 crédito juntando patinhas no mês.",
  INPUT_DELETED: "A foto foi excluída antes de a arte ficar pronta. O crédito foi devolvido.",
  NOT_CONFIGURED: "O Estúdio ainda não está disponível. O crédito foi devolvido.",
  NO_SPACE: "O diário de {dog} chegou ao limite de lembranças, e a arte não teria onde ficar. O crédito foi devolvido.",
  TECHNICAL: "Algo deu errado do nosso lado. O crédito foi devolvido.",
};

// ---------- Compra de créditos (Pix) ----------
export interface CreditPurchase {
  id: string; packageId: string; credits: number; amountCents: number;
  status: "pending" | "approved" | "rejected" | "expired" | "cancelled" | "refunded";
  pixQr: string | null; pixQrBase64: string | null; expiresAt: string | null; createdAt: string; test: boolean;
}
export interface CreditShop { enabled: boolean; test: boolean; packages: { id: string; credits: number; priceCents: number; badge?: string }[]; purchases: CreditPurchase[] }
export const creditShop = () => rpc<CreditShop>("creditShop");
export const createPurchase = (packageId: string, idempotencyKey: string) => rpc<CreditPurchase>("createPurchase", { packageId, idempotencyKey });
export const purchaseStatus = (id: string) => rpc<CreditPurchase>("purchaseStatus", { id });
export const fakePayPurchase = (id: string) => rpc<{ ok: boolean }>("fakePayPurchase", { id });
