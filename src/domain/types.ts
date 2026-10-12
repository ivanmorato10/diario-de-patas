import type { CollectionId } from "@/config/catalog";

/** Data civil "AAAA-MM-DD" — nunca convertida para UTC (§12). */
export type CivilDate = string;

export interface DogPreferences {
  home: boolean;
  outdoor: boolean;
  /** Missões com outros cães só são sugeridas se permitido (§9). */
  socialDogs: boolean;
  /** Missões com pessoas na foto. */
  people: boolean;
}

export interface Profile {
  id: "me";
  timezone: string;
  locale: "pt-BR";
  createdAt: string;
}

export interface Dog {
  id: string;
  name: string;
  photoMediaId: string | null;
  birthDate: CivilDate | null;
  preferences: DogPreferences;
  createdAt: string;
}

export type MediaKind = "photo" | "art";

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  /** SHA-256 do arquivo original: detecta reenvio exato dentro da conta. Não é biometria. */
  hash: string;
  display: Blob;
  thumb: Blob;
  createdAt: string;
}

export type EntrySource = "free" | "mission" | "studio";

export interface DiaryEntry {
  id: string;
  dogId: string;
  mediaId: string;
  caption: string;
  occurredDate: CivilDate;
  timezone: string;
  source: EntrySource;
  missionId: string | null;
  /** Gerada uma vez por tentativa de envio: retry devolve a mesma entrada (§8.5, §19). */
  requestKey: string;
  createdAt: string;
}

export interface AlbumEntry {
  key: string; // `${albumId}:${entryId}` — associação única
  albumId: CollectionId;
  entryId: string;
  addedAt: string;
}

export type SubmissionStatus = "approved" | "uncertain" | "not_matched" | "pending" | "technical_failure";

/**
 * Quem decidiu a missão (MUDANCAS-V2 §1): o modo oficial é a confirmação do próprio dono.
 * "owner" = confirmada pelo dono. "demo_manual" = mesmo significado, gravado por versões anteriores.
 * "ai" = reservado para o validador futuro (desligado; só sugestão, nunca bloqueio).
 */
export type ValidationMode = "owner" | "demo_manual" | "ai";

export interface MissionSubmission {
  id: string;
  requestKey: string;
  missionId: string;
  dogId: string;
  entryId: string;
  status: SubmissionStatus;
  reasonCode: string | null;
  mode: ValidationMode;
  providerVersion: string | null;
  createdAt: string;
}

export interface MissionCompletion {
  /** `${dogId}:${missionId}` — uma conclusão por missão do catálogo por cachorro. */
  instanceKey: string;
  dogId: string;
  missionId: string;
  submissionId: string;
  mode: ValidationMode;
  completedAt: string;
}

export interface XpLedgerEntry {
  id: string;
  dogId: string;
  /** Único: garante uma entrada positiva por conclusão. */
  completionKey: string;
  amount: number;
  reason: string;
  createdAt: string;
}

