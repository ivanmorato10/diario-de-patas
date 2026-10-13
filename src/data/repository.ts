/**
 * Interface única de dados (MUDANCAS-V2 §8): as telas falam só com isto.
 * - Modo demonstração: IndexedDB no navegador (`demo-adapter.ts`).
 * - Modo real (NEXT_PUBLIC_SUPABASE_URL definido): API do próprio app + Supabase (`real-repository.ts`),
 *   com o servidor como autoridade de XP, cotas, plano do dia e posse dos dados.
 */
import type { DailySlot } from "@/config/cycle";
import type { DailyPlan } from "@/domain/cycle";
import type { DocumentMetaInput, HealthDocument } from "@/domain/documents";
import type {
  ContactInput, HealthProfileInput, MedicationInput, VaccineInput, VisitInput, WeightInput,
} from "@/domain/health";
import type { CivilDate, CustomAlbum, DiaryEntry, Dog, EntrySource, MediaAsset, MissionSubmission } from "@/domain/types";
import type { ProcessedDocument } from "@/lib/document-file";
import type { ProcessedImage, Snapshot, SubmitResult } from "./demo-repository";

export type { ProcessedImage, Snapshot, SubmitResult };

export interface ShareLink {
  id: string;
  title: string;
  createdAt: string;
  revokedAt: string | null;
  count: number;
}

export type CareStore = "vaccines" | "visits" | "medications" | "contacts" | "weights";

export interface SaveEntryInput {
  requestKey: string;
  image: ProcessedImage;
  caption: string;
  occurredDate: CivilDate;
  source: EntrySource;
  missionId: string | null;
  albumIds: string[];
  kind?: MediaAsset["kind"];
}

export interface SubmitInput {
  requestKey: string;
  missionId: string;
  entryId: string;
  status: MissionSubmission["status"];
  reasonCode: string | null;
  mode: MissionSubmission["mode"];
  providerVersion: string | null;
}

export interface Repository {
  readonly mode: "demo" | "real";
  loadSnapshot(): Promise<Snapshot>;
  /** Miniatura ou versão de exibição de uma foto do diário. */
  getMediaBlob(id: string, variant: "thumb" | "display"): Promise<Blob | null>;

  createDiary(input: { timezone: string; name: string; birthDate: CivilDate | null; preferences: Dog["preferences"]; photo: ProcessedImage | null }): Promise<Dog>;
  updateDog(patch: Partial<Pick<Dog, "name" | "birthDate" | "preferences">> & { photo?: ProcessedImage | null }): Promise<Dog>;
  updateTimezone(timezone: string): Promise<void>;

  findEntryByHash(hash: string): Promise<DiaryEntry | null>;
  saveEntry(input: SaveEntryInput): Promise<DiaryEntry>;
  updateEntry(id: string, patch: { caption?: string; occurredDate?: CivilDate; albumIds?: string[] }): Promise<DiaryEntry>;
  deleteEntry(id: string): Promise<void>;

  createAlbum(title: string): Promise<CustomAlbum>;
  renameAlbum(id: string, title: string): Promise<CustomAlbum>;
  /** Exclui o álbum; as fotos continuam no diário. */
  deleteAlbum(id: string): Promise<void>;
  addEntriesToAlbum(albumId: string, entryIds: string[]): Promise<void>;

  submitMission(input: SubmitInput): Promise<SubmitResult>;
  swapDaily(slot: DailySlot): Promise<DailyPlan>;

  saveHealthProfile(input: HealthProfileInput): Promise<unknown>;
  addWeight(input: WeightInput): Promise<unknown>;
  saveVaccine(input: VaccineInput, id?: string): Promise<unknown>;
  saveVisit(input: VisitInput, id?: string): Promise<unknown>;
  saveMedication(input: MedicationInput, id?: string): Promise<unknown>;
  saveContact(input: ContactInput, id?: string): Promise<unknown>;
  deleteHealthRecord(store: CareStore, id: string): Promise<void>;

  addDocument(meta: DocumentMetaInput, file: ProcessedDocument): Promise<HealthDocument>;
  updateDocument(id: string, meta: DocumentMetaInput): Promise<HealthDocument>;
  deleteDocument(id: string): Promise<void>;
  getDocumentFile(id: string): Promise<{ file: Blob; thumb: Blob | null } | null>;

  /** Links compartilhados (só com conta: precisam de servidor para serem revogáveis). */
  createShare(title: string, entryIds: string[]): Promise<{ id: string; path: string }>;
  listShares(): Promise<ShareLink[]>;
  revokeShare(id: string): Promise<void>;

  /** Marca que o diário deste aparelho já foi importado para a conta. */
  markDemoImported(): Promise<void>;

  exportMetadata(): Promise<unknown>;
  /** Demo: apaga tudo deste aparelho. Real: exclui a conta (acesso, links, jobs e arquivos). */
  wipe(): Promise<void>;
}
