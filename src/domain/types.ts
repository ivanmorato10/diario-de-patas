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
  /** Quando o diário do modo demonstração foi trazido para a conta (uma única vez, §8.2). */
  demoImportedAt?: string | null;
}

export interface Dog {
  id: string;
  name: string;
  photoMediaId: string | null;
  birthDate: CivilDate | null;
  preferences: DogPreferences;
  /** Ajuste da foto de perfil no círculo: foco x/y em % (0–100) e zoom (1–3). */
  avatarCrop?: AvatarCrop | null;
  createdAt: string;
}

export interface AvatarCrop { x: number; y: number; zoom: number }

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
  /** Família: quem guardou (quando não foi você). */
  createdByName?: string | null;
  /** Quem guardou (só com conta): para o ossinho não valer na própria foto. */
  createdBy?: string | null;
}

/** Papel de cada pessoa num diário (família). */
export type DiaryRole = "admin" | "editor" | "viewer";
export interface DiarySummary { id: string; name: string; photoMediaId: string | null; avatarCrop: AvatarCrop | null; role: DiaryRole; mine?: boolean }
export interface Letter { id: string; body: string; date: CivilDate; createdBy: string | null; createdByName: string | null; mine: boolean; createdAt: string }
export interface Bone { targetType: "entry" | "letter"; targetId: string; userId: string }
export interface Me { userId: string; name: string; nameConfirmed: boolean; suggestedName?: string; notify?: { photo: boolean; letter: boolean; bone: boolean } }
export interface DiaryMember { userId: string; name: string; email: string; role: DiaryRole; me: boolean; owner: boolean }

/** Álbum: uma coleção fixa do catálogo ou um álbum criado pela pessoa (`custom-…`). */
export type AlbumId = CollectionId | `custom-${string}`;

export interface CustomAlbum {
  id: `custom-${string}`;
  title: string;
  createdAt: string;
}

export interface AlbumEntry {
  key: string; // `${albumId}:${entryId}` — associação única
  albumId: AlbumId;
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
  /**
   * Instância que recebeu XP (§7): `${dogId}:${missionId}` (única / item de coleção),
   * `${dogId}:${missionId}:${data}` (missão do dia) ou `${dogId}:${missionId}:${ano}` (especial).
   */
  instanceKey: string;
  dogId: string;
  missionId: string;
  submissionId: string;
  mode: ValidationMode;
  completedAt: string;
  /** Foto usada (gravado a partir da v5; conclusões antigas são completadas pela submissão). */
  entryId?: string;
  /** Data civil do dia em que foi concluída (missões do dia). */
  date?: CivilDate;
}

/** Item de coleção avançado por uma missão do dia, sem XP extra (§7.1 regra 6). */
export interface CollectionAdvance {
  key: string; // `${dogId}:${itemId}`
  dogId: string;
  itemId: string;
  entryId: string | null;
  viaMissionId: string;
  createdAt: string;
}

/** Medalha de coleção completa: concedida uma única vez, com +50 XP. */
export interface Medal {
  key: string; // `${dogId}:${setId}`
  dogId: string;
  setId: string;
  createdAt: string;
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

