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
}) => rpc<StudioJob>("studioCreateJob", input);

export interface PhotoCheck { verdict: "good" | "warn" | "bad"; issues: { code: string; level: "warn" | "bad"; message: string }[]; aiChecked: boolean }
export const studioCheckPhoto = (input: { entryId: string; crop: { x: number; y: number; w: number; h: number } | null }) => rpc<PhotoCheck>("studioCheckPhoto", input);

export const FAILURE_PT: Record<string, string> = {
  PROVIDER_REFUSED: "Não conseguimos usar esta foto. Tente outra em que o cachorro apareça sozinho. O crédito foi devolvido.",
  QUALITY_REJECTED: "A arte não ficou boa o bastante (faltou o cachorro ou apareceu texto). O crédito foi devolvido.",
  PROVIDER_TIMEOUT: "A arte demorou demais e foi cancelada. O crédito foi devolvido.",
  PROVIDER_UNAVAILABLE: "O serviço de artes está instável agora. O crédito foi devolvido — tente mais tarde.",
  NO_CREDITS: "Seus créditos de teste acabaram.",
  INPUT_DELETED: "A foto foi excluída antes de a arte ficar pronta. O crédito foi devolvido.",
  NOT_CONFIGURED: "O Estúdio ainda não está disponível. O crédito foi devolvido.",
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
