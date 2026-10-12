/**
 * Repositório do MODO DEMONSTRAÇÃO (§15): IndexedDB local, sem sincronização.
 * Dados podem ser perdidos ao limpar o navegador. Fotos ficam como Blob (nunca base64/localStorage).
 * Espelha as regras do servidor (idempotência, ledger único de XP, cotas) para que o fluxo
 * se comporte igual; em produção estas regras ficam no backend (Etapa C/D).
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CollectionId } from "@/config/catalog";
import { LIMITS } from "@/config/business";
import { civilDateInTz } from "@/domain/dates";
import { missionById, missionState } from "@/domain/missions";
import type {
  AlbumEntry, CivilDate, DiaryEntry, Dog, MediaAsset, MissionCompletion, MissionSubmission,
  Profile, SubmissionStatus, XpLedgerEntry, EntrySource,
} from "@/domain/types";

export const DEMO_DB_NAME = "diario-de-patas-demo";
/**
 * Versões do banco local. Cada upgrade só ACRESCENTA ou remove o que mudou — nunca recria
 * tabelas com dados do usuário.
 * 1: esquema inicial · 2: remove o contador de validações diárias (MUDANCAS-V2 §1)
 */
const DB_VERSION = 2;

interface DemoDB extends DBSchema {
  profile: { key: string; value: Profile };
  dogs: { key: string; value: Dog };
  media: { key: string; value: MediaAsset; indexes: { hash: string } };
  entries: { key: string; value: DiaryEntry; indexes: { requestKey: string; occurredDate: string } };
  albumEntries: { key: string; value: AlbumEntry; indexes: { albumId: string; entryId: string } };
  submissions: { key: string; value: MissionSubmission; indexes: { requestKey: string } };
  completions: { key: string; value: MissionCompletion };
  xp: { key: string; value: XpLedgerEntry; indexes: { completionKey: string } };
}

export type Db = IDBPDatabase<DemoDB>;

export class DomainError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export function openDemoDb(name = DEMO_DB_NAME): Promise<Db> {
  const db: Promise<Db> = openDB<DemoDB>(name, DB_VERSION, {
    // Outra aba (com uma versão nova do app) pediu um upgrade do banco: solta a conexão
    // para não travá-la e recarrega esta aba para já usar a versão nova.
    blocking() {
      void db.then((d) => d.close());
      if (typeof window !== "undefined") window.location.reload();
    },
    upgrade(db, oldVersion) {
      if (oldVersion < 1) createV1(db);
      // v2: o limite diário de validações deixou de existir.
      if (oldVersion === 1) db.deleteObjectStore("usage" as never);
    },
  });
  return db;
}

function createV1(db: IDBPDatabase<DemoDB>) {
  db.createObjectStore("profile", { keyPath: "id" });
  db.createObjectStore("dogs", { keyPath: "id" });
  db.createObjectStore("media", { keyPath: "id" }).createIndex("hash", "hash");
  const entries = db.createObjectStore("entries", { keyPath: "id" });
  entries.createIndex("requestKey", "requestKey", { unique: true });
  entries.createIndex("occurredDate", "occurredDate");
  const ae = db.createObjectStore("albumEntries", { keyPath: "key" });
  ae.createIndex("albumId", "albumId");
  ae.createIndex("entryId", "entryId");
  db.createObjectStore("submissions", { keyPath: "id" }).createIndex("requestKey", "requestKey", { unique: true });
  db.createObjectStore("completions", { keyPath: "instanceKey" });
  db.createObjectStore("xp", { keyPath: "id" }).createIndex("completionKey", "completionKey", { unique: true });
}

const STORES = ["profile", "dogs", "media", "entries", "albumEntries", "submissions", "completions", "xp"] as const;

/**
 * Esvazia todas as tabelas numa única transação. Não usa deleteDB: apagar o banco fica
 * "bloqueado" para sempre enquanto outra aba (ou o app instalado) mantém uma conexão aberta.
 */
export async function resetDemo(db: Db) {
  const tx = db.transaction(STORES, "readwrite");
  await Promise.all([...STORES.map((s) => tx.objectStore(s).clear()), tx.done]);
}

const now = () => new Date().toISOString();

/** Aborta a transação, aguarda o rollback e lança o erro de domínio. */
async function fail(tx: { abort(): void; done: Promise<void> }, err: Error): Promise<never> {
  try { tx.abort(); } catch { /* já finalizada */ }
  await tx.done.catch(() => undefined);
  throw err;
}
export const newId = () => crypto.randomUUID();

export interface ProcessedImage {
  mime: string;
  width: number;
  height: number;
  bytes: number;
  hash: string;
  display: Blob;
  thumb: Blob;
  /** Data em que a foto foi tirada (EXIF), quando o arquivo trouxer. Só sugestão para o campo de data. */
  takenDate?: CivilDate | null;
}

export interface Snapshot {
  profile: Profile | null;
  dog: Dog | null;
  entries: DiaryEntry[];
  albumEntries: AlbumEntry[];
  completions: MissionCompletion[];
  xpTotal: number;
  today: CivilDate;
}

export async function loadSnapshot(db: Db): Promise<Snapshot> {
  const profile = (await db.get("profile", "me")) ?? null;
  const dogs = await db.getAll("dogs");
  const entries = await db.getAll("entries");
  entries.sort((a, b) => (a.occurredDate === b.occurredDate ? b.createdAt.localeCompare(a.createdAt) : b.occurredDate.localeCompare(a.occurredDate)));
  const xp = await db.getAll("xp");
  const tz = profile?.timezone ?? "UTC";
  const today = civilDateInTz(new Date(), tz);
  return {
    profile,
    dog: dogs[0] ?? null,
    entries,
    albumEntries: await db.getAll("albumEntries"),
    completions: await db.getAll("completions"),
    xpTotal: xp.reduce((s, e) => s + e.amount, 0),
    today,
  };
}

export const getMedia = (db: Db, id: string) => db.get("media", id);

function mediaFrom(img: ProcessedImage, kind: MediaAsset["kind"]): MediaAsset {
  return { id: newId(), kind, mime: img.mime, width: img.width, height: img.height, bytes: img.bytes, hash: img.hash, display: img.display, thumb: img.thumb, createdAt: now() };
}

export async function createDiary(
  db: Db,
  input: { timezone: string; name: string; birthDate: CivilDate | null; preferences: Dog["preferences"]; photo: ProcessedImage | null },
): Promise<Dog> {
  const name = input.name.trim().slice(0, LIMITS.dogNameMaxChars);
  if (!name) throw new DomainError("NAME_REQUIRED", "Conte para a gente o nome do seu cachorro.");
  const tx = db.transaction(["profile", "dogs", "media"], "readwrite");
  const existing = await tx.objectStore("dogs").getAll();
  if (existing.length >= LIMITS.dogsPerAccount) {
    await tx.done;
    return existing[0];
  }
  let photoMediaId: string | null = null;
  if (input.photo) {
    const m = mediaFrom(input.photo, "photo");
    await tx.objectStore("media").put(m);
    photoMediaId = m.id;
  }
  await tx.objectStore("profile").put({ id: "me", timezone: input.timezone, locale: "pt-BR", createdAt: now() });
  const dog: Dog = { id: newId(), name, photoMediaId, birthDate: input.birthDate, preferences: input.preferences, createdAt: now() };
  await tx.objectStore("dogs").put(dog);
  await tx.done;
  return dog;
}

export async function updateDog(db: Db, patch: Partial<Pick<Dog, "name" | "birthDate" | "preferences">> & { photo?: ProcessedImage | null }) {
  const tx = db.transaction(["dogs", "media"], "readwrite");
  const [dog] = await tx.objectStore("dogs").getAll();
  if (!dog) throw new DomainError("NO_DOG", "Diário não encontrado.");
  const next: Dog = { ...dog };
  if (patch.name !== undefined) {
    const n = patch.name.trim().slice(0, LIMITS.dogNameMaxChars);
    if (!n) throw new DomainError("NAME_REQUIRED", "O nome não pode ficar vazio.");
    next.name = n;
  }
  if (patch.birthDate !== undefined) next.birthDate = patch.birthDate;
  if (patch.preferences) next.preferences = patch.preferences;
  if (patch.photo !== undefined) {
    if (dog.photoMediaId) await tx.objectStore("media").delete(dog.photoMediaId);
    next.photoMediaId = null;
    if (patch.photo) {
      const m = mediaFrom(patch.photo, "photo");
      await tx.objectStore("media").put(m);
      next.photoMediaId = m.id;
    }
  }
  await tx.objectStore("dogs").put(next);
  await tx.done;
  return next;
}

export async function updateTimezone(db: Db, timezone: string) {
  const p = await db.get("profile", "me");
  if (p) await db.put("profile", { ...p, timezone });
}

export async function findEntryByHash(db: Db, hash: string): Promise<DiaryEntry | null> {
  const media = await db.getAllFromIndex("media", "hash", hash);
  if (media.length === 0) return null;
  const ids = new Set(media.map((m) => m.id));
  return (await db.getAll("entries")).find((x) => ids.has(x.mediaId)) ?? null;
}

export async function saveEntry(
  db: Db,
  input: {
    requestKey: string;
    image: ProcessedImage;
    caption: string;
    occurredDate: CivilDate;
    source: EntrySource;
    missionId: string | null;
    albumIds: CollectionId[];
    kind?: MediaAsset["kind"];
  },
): Promise<DiaryEntry> {
  const tx = db.transaction(["dogs", "profile", "media", "entries", "albumEntries"], "readwrite");
  const existing = await tx.objectStore("entries").index("requestKey").get(input.requestKey);
  if (existing) {
    await tx.done;
    return existing; // retry/duplo clique: mesma entrada
  }
  const [dog] = await tx.objectStore("dogs").getAll();
  const profile = await tx.objectStore("profile").get("me");
  if (!dog || !profile) throw new DomainError("NO_DOG", "Crie o diário antes de guardar fotos.");
  const count = await tx.objectStore("entries").count();
  if (count >= LIMITS.maxEntries) {
    return fail(tx, new DomainError("STORAGE_QUOTA", `O diário chegou ao limite de ${LIMITS.maxEntries} lembranças desta versão de teste. Nada foi apagado.`));
  }
  const media = mediaFrom(input.image, input.kind ?? "photo");
  await tx.objectStore("media").put(media);
  const entry: DiaryEntry = {
    id: newId(),
    dogId: dog.id,
    mediaId: media.id,
    caption: input.caption.trim().slice(0, LIMITS.captionMaxChars),
    occurredDate: input.occurredDate,
    timezone: profile.timezone,
    source: input.source,
    missionId: input.missionId,
    requestKey: input.requestKey,
    createdAt: now(),
  };
  await tx.objectStore("entries").put(entry);
  for (const albumId of new Set(input.albumIds)) {
    await tx.objectStore("albumEntries").put({ key: `${albumId}:${entry.id}`, albumId, entryId: entry.id, addedAt: now() });
  }
  await tx.done;
  return entry;
}

export async function updateEntry(db: Db, id: string, patch: { caption?: string; occurredDate?: CivilDate; albumIds?: CollectionId[] }) {
  const tx = db.transaction(["entries", "albumEntries"], "readwrite");
  const e = await tx.objectStore("entries").get(id);
  if (!e) throw new DomainError("NOT_FOUND", "Lembrança não encontrada.");
  const next = { ...e };
  if (patch.caption !== undefined) next.caption = patch.caption.trim().slice(0, LIMITS.captionMaxChars);
  if (patch.occurredDate !== undefined) next.occurredDate = patch.occurredDate;
  await tx.objectStore("entries").put(next);
  if (patch.albumIds) {
    const store = tx.objectStore("albumEntries");
    const current = await store.index("entryId").getAll(id);
    const wanted = new Set(patch.albumIds);
    for (const a of current) if (!wanted.has(a.albumId)) await store.delete(a.key);
    for (const albumId of wanted) await store.put({ key: `${albumId}:${id}`, albumId, entryId: id, addedAt: now() });
  }
  await tx.done;
  return next;
}

/** Exclui a lembrança e a mídia; conquista e XP permanecem (§9). */
export async function deleteEntry(db: Db, id: string) {
  const tx = db.transaction(["entries", "media", "albumEntries"], "readwrite");
  const e = await tx.objectStore("entries").get(id);
  if (!e) return;
  const links = await tx.objectStore("albumEntries").index("entryId").getAll(id);
  for (const l of links) await tx.objectStore("albumEntries").delete(l.key);
  await tx.objectStore("media").delete(e.mediaId);
  await tx.objectStore("entries").delete(id);
  await tx.done;
}

export interface SubmitResult {
  submission: MissionSubmission;
  completion: MissionCompletion | null;
  xpAwarded: number;
  alreadyCompleted: boolean;
}

/**
 * Registra a submissão de missão de forma idempotente e concede XP uma única vez.
 * A decisão vem da confirmação do dono (mode = "owner") — sem IA e sem limite diário (MUDANCAS-V2 §1).
 */
export async function submitMission(
  db: Db,
  input: { requestKey: string; missionId: string; entryId: string; status: SubmissionStatus; reasonCode: string | null; mode: MissionSubmission["mode"]; providerVersion: string | null },
): Promise<SubmitResult> {
  const mission = missionById(input.missionId);
  if (!mission) throw new DomainError("UNKNOWN_MISSION", "Missão não encontrada.");
  const tx = db.transaction(["profile", "dogs", "entries", "submissions", "completions", "xp", "albumEntries"], "readwrite");
  const prior = await tx.objectStore("submissions").index("requestKey").get(input.requestKey);
  if (prior) {
    const completion = (await tx.objectStore("completions").get(`${prior.dogId}:${prior.missionId}`)) ?? null;
    await tx.done;
    return { submission: prior, completion, xpAwarded: 0, alreadyCompleted: true };
  }
  const [dog] = await tx.objectStore("dogs").getAll();
  const profile = await tx.objectStore("profile").get("me");
  const entry = await tx.objectStore("entries").get(input.entryId);
  if (!dog || !profile || !entry || entry.dogId !== dog.id) {
    return fail(tx, new DomainError("NOT_FOUND", "Não encontramos essa lembrança."));
  }
  // Arte do Estúdio nunca conclui missão de foto real (§11).
  if (entry.source === "studio") {
    return fail(tx, new DomainError("ART_NOT_ALLOWED", "Artes do Estúdio não concluem missões — escolha uma foto."));
  }
  // Uma foto rende pontos em uma única missão (MUDANCAS-V2 §7.1).
  if (entry.missionId && entry.missionId !== mission.id) {
    return fail(tx, new DomainError("PHOTO_ALREADY_USED", "Essa foto já foi usada em outra missão. Escolha outra foto."));
  }
  const completedSet = new Set((await tx.objectStore("completions").getAll()).map((c) => c.missionId));
  if (missionState(mission, completedSet) === "locked") {
    return fail(tx, new DomainError("LOCKED", "Essa missão abre depois de concluir a anterior."));
  }
  const submission: MissionSubmission = {
    id: newId(), requestKey: input.requestKey, missionId: mission.id, dogId: dog.id, entryId: entry.id,
    status: input.status, reasonCode: input.reasonCode, mode: input.mode, providerVersion: input.providerVersion, createdAt: now(),
  };
  await tx.objectStore("submissions").put(submission);

  let completion: MissionCompletion | null = null;
  let xpAwarded = 0;
  let alreadyCompleted = false;
  if (submission.status === "approved") {
    const instanceKey = `${dog.id}:${mission.id}`;
    const existing = await tx.objectStore("completions").get(instanceKey);
    if (existing) {
      completion = existing;
      alreadyCompleted = true;
    } else {
      completion = { instanceKey, dogId: dog.id, missionId: mission.id, submissionId: submission.id, mode: submission.mode, completedAt: now() };
      await tx.objectStore("completions").put(completion);
      // índice único em completionKey impede uma segunda entrada positiva
      await tx.objectStore("xp").add({ id: newId(), dogId: dog.id, completionKey: instanceKey, amount: mission.xp, reason: `mission:${mission.id}`, createdAt: now() });
      xpAwarded = mission.xp;
    }
    await tx.objectStore("entries").put({ ...entry, source: "mission", missionId: mission.id });
    await tx.objectStore("albumEntries").put({ key: `${mission.collectionId}:${entry.id}`, albumId: mission.collectionId, entryId: entry.id, addedAt: now() });
  }
  await tx.done;
  return { submission, completion, xpAwarded, alreadyCompleted };
}

/** Exportação simples (metadados). Exportação elaborada com fotos é P1. */
export async function exportMetadata(db: Db) {
  const snap = await loadSnapshot(db);
  return {
    exportedAt: now(),
    mode: "demo-local",
    profile: snap.profile,
    dog: snap.dog && { ...snap.dog, photoMediaId: undefined },
    entries: snap.entries.map(({ requestKey: _r, ...e }) => e),
    albums: snap.albumEntries,
    achievements: snap.completions,
    xpTotal: snap.xpTotal,
  };
}
