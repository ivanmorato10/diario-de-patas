/**
 * Repositório do MODO DEMONSTRAÇÃO (§15): IndexedDB local, sem sincronização.
 * Dados podem ser perdidos ao limpar o navegador. Fotos ficam como Blob (nunca base64/localStorage).
 * Espelha as regras do servidor (idempotência, ledger único de XP, cotas) para que o fluxo
 * se comporte igual; em produção estas regras ficam no backend (Etapa C/D).
 */
import { xpMonthOf } from "@/config/credits";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { COLLECTIONS, type CollectionId } from "@/config/catalog";
import { LIMITS } from "@/config/business";
import { civilDateInTz } from "@/domain/dates";
import { missionById } from "@/domain/missions";
import {
  ContactSchema, EMPTY_HEALTH, HealthProfileSchema, MedicationSchema, VaccineSchema, VisitSchema, WeightSchema, firstIssue,
  type Contact, type ContactInput, type HealthData, type HealthProfile, type HealthProfileInput, type Medication, type MedicationInput,
  type Vaccine, type VaccineInput, type Visit, type VisitInput, type WeightInput, type WeightRecord,
} from "@/domain/health";
import type { ZodType } from "zod";
import { DocumentMetaSchema, type DocumentFile, type DocumentMetaInput, type HealthDocument } from "@/domain/documents";
import type { ProcessedDocument } from "@/lib/document-file";
import { CYCLE_XP, type DailySlot } from "@/config/cycle";
import { activeSpecials, buildHistory, generatePlan, instanceKey as instanceKeyFor, setProgress, setsContaining, swapInPlan, type DailyPlan } from "@/domain/cycle";
import type {
  AlbumEntry, AlbumId, CivilDate, CollectionAdvance, CustomAlbum, Medal, DiaryEntry, Dog, MediaAsset, MissionCompletion, MissionSubmission,
  Profile, SubmissionStatus, XpLedgerEntry, EntrySource, DiaryMember, DiaryRole, DiarySummary, Letter, Bone, Me } from "@/domain/types";

export const DEMO_DB_NAME = "diario-de-patas-demo";
/**
 * Versões do banco local. Cada upgrade só ACRESCENTA ou remove o que mudou — nunca recria
 * tabelas com dados do usuário.
 * 1: esquema inicial · 2: remove o contador de validações diárias (MUDANCAS-V2 §1)
 * 3: ficha de cuidados — healthProfile, weights, vaccines, visits, medications, contacts (§4)
 * 4: documentos — metadados em documents, arquivo em documentFiles (§5)
 * 5: ciclo contínuo — dailyPlans, collectionAdvances, medals (§7)
 * 6: álbuns criados pela pessoa — customAlbums
 */
const DB_VERSION = 6;

interface DemoDB extends DBSchema {
  profile: { key: string; value: Profile };
  dogs: { key: string; value: Dog };
  media: { key: string; value: MediaAsset; indexes: { hash: string } };
  entries: { key: string; value: DiaryEntry; indexes: { requestKey: string; occurredDate: string } };
  albumEntries: { key: string; value: AlbumEntry; indexes: { albumId: string; entryId: string } };
  submissions: { key: string; value: MissionSubmission; indexes: { requestKey: string } };
  completions: { key: string; value: MissionCompletion };
  xp: { key: string; value: XpLedgerEntry; indexes: { completionKey: string } };
  healthProfile: { key: string; value: HealthProfile };
  weights: { key: string; value: WeightRecord };
  vaccines: { key: string; value: Vaccine };
  visits: { key: string; value: Visit };
  medications: { key: string; value: Medication };
  contacts: { key: string; value: Contact };
  documents: { key: string; value: HealthDocument };
  documentFiles: { key: string; value: DocumentFile };
  dailyPlans: { key: string; value: DailyPlan };
  collectionAdvances: { key: string; value: CollectionAdvance };
  medals: { key: string; value: Medal };
  customAlbums: { key: string; value: CustomAlbum };
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
      if (oldVersion < 3) createV3(db);
      if (oldVersion < 4) {
        db.createObjectStore("documents", { keyPath: "id" });
        db.createObjectStore("documentFiles", { keyPath: "id" });
      }
      if (oldVersion < 5) {
        db.createObjectStore("dailyPlans", { keyPath: "key" });
        db.createObjectStore("collectionAdvances", { keyPath: "key" });
        db.createObjectStore("medals", { keyPath: "key" });
      }
      if (oldVersion < 6) db.createObjectStore("customAlbums", { keyPath: "id" });
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

function createV3(db: IDBPDatabase<DemoDB>) {
  db.createObjectStore("healthProfile", { keyPath: "dogId" });
  for (const s of ["weights", "vaccines", "visits", "medications", "contacts"] as const) db.createObjectStore(s, { keyPath: "id" });
}

const STORES = [
  "profile", "dogs", "media", "entries", "albumEntries", "submissions", "completions", "xp",
  "healthProfile", "weights", "vaccines", "visits", "medications", "contacts", "documents", "documentFiles",
  "dailyPlans", "collectionAdvances", "medals", "customAlbums",
] as const;

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
  /** Com conta: papel no diário aberto, lista de diários (seletor) e membros (família). Demo: ausentes. */
  role?: DiaryRole | null;
  diaries?: DiarySummary[];
  members?: DiaryMember[];
  /** Só com conta: quem está usando, cartinhas e ossinhos. */
  me?: Me;
  letters?: Letter[];
  bones?: Bone[];
  /** Avisos da família ainda não vistos (sininho). */
  unread?: number;
  entries: DiaryEntry[];
  albumEntries: AlbumEntry[];
  completions: MissionCompletion[];
  xpTotal: number;
  /** XP ganho no mês atual (fuso fixo do XP); zera na virada do mês. */
  xpMonth: number;
  today: CivilDate;
  /** Ficha de cuidados — privada; nunca vai para compartilhamentos (§4). */
  health: HealthData;
  /** Missões do dia de hoje (gravadas na primeira abertura do dia, §7.1). */
  dailyPlan: DailyPlan | null;
  collectionAdvances: CollectionAdvance[];
  medals: Medal[];
  /** Álbuns criados pela pessoa, mais antigos primeiro. */
  customAlbums: CustomAlbum[];
}

export async function loadSnapshot(db: Db): Promise<Snapshot> {
  const profile = (await db.get("profile", "me")) ?? null;
  const dogs = await db.getAll("dogs");
  const entries = await db.getAll("entries");
  entries.sort((a, b) => (a.occurredDate === b.occurredDate ? b.createdAt.localeCompare(a.createdAt) : b.occurredDate.localeCompare(a.occurredDate)));
  const xp = await db.getAll("xp");
  const tz = profile?.timezone ?? "UTC";
  const today = civilDateInTz(new Date(), tz);
  // Conclusões antigas não guardavam a foto: completa pela submissão aceita.
  const subs = new Map((await db.getAll("submissions")).map((s) => [s.id, s.entryId]));
  const completions = (await db.getAll("completions")).map((c) => (c.entryId ? c : { ...c, entryId: subs.get(c.submissionId) }));
  return {
    profile,
    dog: dogs[0] ?? null,
    entries,
    albumEntries: await db.getAll("albumEntries"),
    completions,
    xpTotal: xp.reduce((s, e) => s + e.amount, 0),
    xpMonth: xp.filter((e) => xpMonthOf(e.createdAt) === xpMonthOf(new Date())).reduce((s, e) => s + e.amount, 0),
    today,
    health: dogs[0] ? await loadHealth(db, dogs[0].id) : EMPTY_HEALTH,
    dailyPlan: dogs[0] ? await ensureDailyPlan(db, dogs[0], today) : null,
    collectionAdvances: await db.getAll("collectionAdvances"),
    medals: await db.getAll("medals"),
    customAlbums: (await db.getAll("customAlbums")).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

// ---------- Álbuns criados pela pessoa ----------

const albumTitle = (t: string) => {
  const title = t.trim().replace(/\s+/g, " ").slice(0, LIMITS.albumTitleMaxChars);
  if (!title) throw new DomainError("INVALID", "Dê um nome ao álbum.");
  return title;
};

export async function createAlbum(db: Db, title: string): Promise<CustomAlbum> {
  const name = albumTitle(title);
  const tx = db.transaction("customAlbums", "readwrite");
  if ((await tx.store.count()) >= LIMITS.maxCustomAlbums) {
    return fail(tx, new DomainError("ALBUM_QUOTA", `Cabem até ${LIMITS.maxCustomAlbums} álbuns nesta versão de teste.`));
  }
  const album: CustomAlbum = { id: `custom-${newId()}`, title: name, createdAt: now() };
  await tx.store.put(album);
  await tx.done;
  return album;
}

export async function renameAlbum(db: Db, id: string, title: string): Promise<CustomAlbum> {
  const album = await db.get("customAlbums", id);
  if (!album) throw new DomainError("NOT_FOUND", "Álbum não encontrado.");
  const next = { ...album, title: albumTitle(title) };
  await db.put("customAlbums", next);
  return next;
}

/** Exclui o álbum; as fotos continuam no diário (e em outros álbuns). */
export async function deleteAlbum(db: Db, id: string) {
  const tx = db.transaction(["customAlbums", "albumEntries"], "readwrite");
  await tx.objectStore("customAlbums").delete(id);
  for (const a of await tx.objectStore("albumEntries").index("albumId").getAll(id)) await tx.objectStore("albumEntries").delete(a.key);
  await tx.done;
}

/** Só álbuns que existem: coleções do catálogo ou álbuns da pessoa. */
async function validAlbumIds(db: Db, ids: readonly string[]): Promise<AlbumId[]> {
  const custom = new Set((await db.getAllKeys("customAlbums")) as string[]);
  const fixed = new Set<string>(COLLECTIONS.map((c) => c.id));
  return [...new Set(ids)].filter((id) => fixed.has(id) || custom.has(id)) as AlbumId[];
}

/** Coloca várias fotos do diário num álbum (sem duplicar). */
export async function addEntriesToAlbum(db: Db, albumId: string, entryIds: readonly string[]) {
  const [ok] = await validAlbumIds(db, [albumId]);
  if (!ok) throw new DomainError("NOT_FOUND", "Álbum não encontrado.");
  const tx = db.transaction(["entries", "albumEntries"], "readwrite");
  for (const entryId of new Set(entryIds)) {
    if (await tx.objectStore("entries").get(entryId)) await tx.objectStore("albumEntries").put({ key: `${ok}:${entryId}`, albumId: ok, entryId, addedAt: now() });
  }
  await tx.done;
}

// ---------- Ciclo contínuo (MUDANCAS-V2 §7) ----------

async function dailyHistory(db: Db, dogId: string, before: CivilDate) {
  const plans = (await db.getAll("dailyPlans")).filter((p) => p.dogId === dogId);
  const daily = (await db.getAll("completions")).filter((c) => c.dogId === dogId && c.date && missionById(c.missionId)?.kind === "daily").map((c) => ({ missionId: c.missionId, date: c.date! }));
  return buildHistory(plans, daily, before);
}

/** Na primeira abertura do dia o plano é gravado; reabrir no mesmo dia mostra o mesmo plano. */
export async function ensureDailyPlan(db: Db, dog: Dog, today: CivilDate): Promise<DailyPlan> {
  const key = `${dog.id}:${today}`;
  const existing = await db.get("dailyPlans", key);
  if (existing) return existing;
  const plan = generatePlan(dog.id, today, dog.preferences, await dailyHistory(db, dog.id, today), now());
  const tx = db.transaction("dailyPlans", "readwrite");
  const raced = await tx.store.get(key); // outra aba pode ter gravado no meio-tempo
  if (!raced) await tx.store.put(plan);
  await tx.done;
  return raced ?? plan;
}

/** Trocar uma sugestão do dia é gratuito e fica gravado no plano (§7.1 regra 3). */
export async function swapDaily(db: Db, slot: DailySlot): Promise<DailyPlan> {
  const [dog] = await db.getAll("dogs");
  const profile = await db.get("profile", "me");
  if (!dog || !profile) throw new DomainError("NO_DOG", "Crie o diário antes.");
  const today = civilDateInTz(new Date(), profile.timezone);
  const plan = await ensureDailyPlan(db, dog, today);
  const next = swapInPlan(plan, slot, dog.preferences, await dailyHistory(db, dog.id, today));
  await db.put("dailyPlans", next);
  return next;
}

const CONTACT_ORDER = ["emergency", "vet", "clinic", "sitter", "other"];

async function loadHealth(db: Db, dogId: string): Promise<HealthData> {
  const byDesc = <T,>(k: keyof T) => (a: T, b: T) => String(b[k]).localeCompare(String(a[k]));
  return {
    profile: (await db.get("healthProfile", dogId)) ?? null,
    weights: (await db.getAll("weights")).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    vaccines: (await db.getAll("vaccines")).sort(byDesc<Vaccine>("appliedDate")),
    visits: (await db.getAll("visits")).sort(byDesc<Visit>("date")),
    medications: (await db.getAll("medications")).sort(byDesc<Medication>("startDate")),
    contacts: (await db.getAll("contacts")).sort((a, b) => CONTACT_ORDER.indexOf(a.kind) - CONTACT_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name, "pt-BR")),
    documents: (await db.getAll("documents")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
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

export async function updateDog(db: Db, patch: Partial<Pick<Dog, "name" | "birthDate" | "preferences" | "avatarCrop">> & { photo?: ProcessedImage | null }) {
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
  if (patch.avatarCrop !== undefined) next.avatarCrop = patch.avatarCrop;
  if (patch.photo !== undefined) {
    if (patch.avatarCrop === undefined) next.avatarCrop = null; // foto nova: começa centralizada
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

export async function markDemoImported(db: Db) {
  const p = await db.get("profile", "me");
  if (p) await db.put("profile", { ...p, demoImportedAt: now() });
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
    albumIds: string[];
    kind?: MediaAsset["kind"];
  },
): Promise<DiaryEntry> {
  const albumIds = await validAlbumIds(db, input.albumIds);
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
  for (const albumId of albumIds) {
    await tx.objectStore("albumEntries").put({ key: `${albumId}:${entry.id}`, albumId, entryId: entry.id, addedAt: now() });
  }
  await tx.done;
  return entry;
}

export async function updateEntry(db: Db, id: string, patch: { caption?: string; occurredDate?: CivilDate; albumIds?: string[] }) {
  const albumIds = patch.albumIds ? await validAlbumIds(db, patch.albumIds) : undefined;
  const tx = db.transaction(["entries", "albumEntries"], "readwrite");
  const e = await tx.objectStore("entries").get(id);
  if (!e) throw new DomainError("NOT_FOUND", "Lembrança não encontrada.");
  const next = { ...e };
  if (patch.caption !== undefined) next.caption = patch.caption.trim().slice(0, LIMITS.captionMaxChars);
  if (patch.occurredDate !== undefined) next.occurredDate = patch.occurredDate;
  await tx.objectStore("entries").put(next);
  if (albumIds) {
    const store = tx.objectStore("albumEntries");
    const current = await store.index("entryId").getAll(id);
    const wanted = new Set<AlbumId>(albumIds);
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
  /** XP total desta conclusão, incluindo medalhas. */
  xpAwarded: number;
  /** Créditos do Estúdio ganhos por XP (só com conta). */
  creditsEarned?: number;
  alreadyCompleted: boolean;
  /** Item de coleção avançado por uma missão do dia (sem XP extra). */
  advancedItem?: string;
  /** Coleções completadas agora (medalha + 50 XP). */
  medals: string[];
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
  const tx = db.transaction(["profile", "dogs", "entries", "submissions", "completions", "xp", "albumEntries", "dailyPlans", "collectionAdvances", "medals"], "readwrite");
  const prior = await tx.objectStore("submissions").index("requestKey").get(input.requestKey);
  if (prior) {
    const completion = (await tx.objectStore("completions").getAll()).find((c) => c.submissionId === prior.id) ?? null;
    await tx.done;
    return { submission: prior, completion, xpAwarded: 0, alreadyCompleted: true, medals: [] };
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
  const allCompletions = await tx.objectStore("completions").getAll();
  const completedSet = new Set(allCompletions.map((c) => c.missionId));
  if (mission.prerequisiteId && !completedSet.has(mission.prerequisiteId)) {
    return fail(tx, new DomainError("LOCKED", "Essa missão abre depois de concluir a anterior."));
  }
  const today = civilDateInTz(new Date(), profile.timezone);
  let occurrence: string | undefined;
  if (mission.kind === "daily") {
    const plan = await tx.objectStore("dailyPlans").get(`${dog.id}:${today}`);
    if (!plan || !Object.values(plan.slots).includes(mission.id)) {
      return fail(tx, new DomainError("NOT_TODAY", "Essa missão do dia não está nas sugestões de hoje. A foto continua no diário."));
    }
  } else if (mission.kind === "special") {
    const w = activeSpecials(today, dog.birthDate, dog.name).find((x) => x.mission.id === mission.id);
    if (!w) return fail(tx, new DomainError("OUT_OF_WINDOW", "Essa missão especial não está disponível agora. A foto continua no diário."));
    occurrence = w.occurrence;
  }
  const key = instanceKeyFor(dog.id, mission, today, occurrence);
  // Uma foto rende pontos em uma única conquista — nem a mesma missão do dia em outro dia.
  if (input.status === "approved" && allCompletions.some((c) => c.entryId === entry.id && c.instanceKey !== key)) {
    return fail(tx, new DomainError("PHOTO_ALREADY_USED", "Essa foto já rendeu pontos em outra missão. Escolha outra foto."));
  }
  const submission: MissionSubmission = {
    id: newId(), requestKey: input.requestKey, missionId: mission.id, dogId: dog.id, entryId: entry.id,
    status: input.status, reasonCode: input.reasonCode, mode: input.mode, providerVersion: input.providerVersion, createdAt: now(),
  };
  await tx.objectStore("submissions").put(submission);

  let completion: MissionCompletion | null = null;
  let xpAwarded = 0;
  let alreadyCompleted = false;
  let advancedItem: string | undefined;
  const medals: string[] = [];
  if (submission.status === "approved") {
    const existing = await tx.objectStore("completions").get(key);
    if (existing) {
      completion = existing;
      alreadyCompleted = true;
    } else {
      completion = { instanceKey: key, dogId: dog.id, missionId: mission.id, submissionId: submission.id, mode: submission.mode, completedAt: now(), entryId: entry.id, date: today };
      await tx.objectStore("completions").put(completion);
      // índice único em completionKey impede uma segunda entrada positiva
      await tx.objectStore("xp").add({ id: newId(), dogId: dog.id, completionKey: key, amount: mission.xp, reason: `mission:${mission.id}`, createdAt: now() });
      xpAwarded = mission.xp;

      // Missão do dia ligada a um item de coleção: avança o item, sem XP extra (§7.1 regra 6).
      const completedNow = [...allCompletions, completion];
      if (mission.advancesItem && !completedNow.some((c) => c.missionId === mission.advancesItem)) {
        const advKey = `${dog.id}:${mission.advancesItem}`;
        if (!(await tx.objectStore("collectionAdvances").get(advKey))) {
          await tx.objectStore("collectionAdvances").put({ key: advKey, dogId: dog.id, itemId: mission.advancesItem, entryId: entry.id, viaMissionId: mission.id, createdAt: now() });
          advancedItem = mission.advancesItem;
        }
      }
      // Coleção completa: medalha + 50 XP uma única vez (a checagem roda dentro da mesma transação).
      const touched = new Set([...setsContaining(mission.id), ...(mission.advancesItem ? setsContaining(mission.advancesItem) : [])]);
      if (touched.size) {
        const progress = setProgress(completedNow, await tx.objectStore("collectionAdvances").getAll());
        for (const p of progress) {
          if (!touched.has(p.set.id) || !p.complete) continue;
          const medalKey = `${dog.id}:${p.set.id}`;
          if (await tx.objectStore("medals").get(medalKey)) continue;
          await tx.objectStore("medals").put({ key: medalKey, dogId: dog.id, setId: p.set.id, createdAt: now() });
          await tx.objectStore("xp").add({ id: newId(), dogId: dog.id, completionKey: `medal:${medalKey}`, amount: CYCLE_XP.collectionMedal, reason: `medal:${p.set.id}`, createdAt: now() });
          xpAwarded += CYCLE_XP.collectionMedal;
          medals.push(p.set.id);
        }
      }
    }
    await tx.objectStore("entries").put({ ...entry, source: "mission", missionId: mission.id });
    await tx.objectStore("albumEntries").put({ key: `${mission.collectionId}:${entry.id}`, albumId: mission.collectionId, entryId: entry.id, addedAt: now() });
  }
  await tx.done;
  return { submission, completion, xpAwarded, alreadyCompleted, advancedItem, medals };
}

// ---------- Ficha de cuidados (MUDANCAS-V2 §4) — registro do dono, sem interpretação ----------

function parse<T>(schema: ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new DomainError("INVALID", firstIssue(r.error));
  return r.data;
}

async function currentDogId(db: Db): Promise<string> {
  const [dog] = await db.getAll("dogs");
  if (!dog) throw new DomainError("NO_DOG", "Crie o diário antes.");
  return dog.id;
}

export async function saveHealthProfile(db: Db, input: HealthProfileInput): Promise<HealthProfile> {
  const data = parse(HealthProfileSchema, input);
  const rec: HealthProfile = { ...data, dogId: await currentDogId(db), updatedAt: now() };
  await db.put("healthProfile", rec);
  return rec;
}

export async function addWeight(db: Db, input: WeightInput): Promise<WeightRecord> {
  const data = parse(WeightSchema, input);
  const rec: WeightRecord = { ...data, id: newId(), dogId: await currentDogId(db), createdAt: now() };
  await db.put("weights", rec);
  return rec;
}

type CareStore = "vaccines" | "visits" | "medications" | "contacts";
type CareRecord = { vaccines: Vaccine; visits: Visit; medications: Medication; contacts: Contact };

/** Cria (sem id) ou edita (com id) um registro da ficha. */
async function upsertCare<S extends CareStore>(db: Db, store: S, schema: ZodType<Omit<CareRecord[S], "id" | "dogId" | "createdAt" | "updatedAt">>, input: unknown, id?: string): Promise<CareRecord[S]> {
  const data = parse(schema, input);
  const dogId = await currentDogId(db);
  const prev = id ? ((await db.get(store, id)) as CareRecord[S] | undefined) : undefined;
  if (id && !prev) throw new DomainError("NOT_FOUND", "Registro não encontrado.");
  const rec = { ...data, id: id ?? newId(), dogId, createdAt: prev?.createdAt ?? now(), updatedAt: now() } as CareRecord[S];
  await db.put(store, rec as never);
  return rec;
}

export const saveVaccine = (db: Db, input: VaccineInput, id?: string) => upsertCare(db, "vaccines", VaccineSchema, input, id);
export const saveVisit = (db: Db, input: VisitInput, id?: string) => upsertCare(db, "visits", VisitSchema, input, id);
export const saveMedication = (db: Db, input: MedicationInput, id?: string) => upsertCare(db, "medications", MedicationSchema, input, id);
export const saveContact = (db: Db, input: ContactInput, id?: string) => upsertCare(db, "contacts", ContactSchema, input, id);

export async function deleteHealthRecord(db: Db, store: CareStore | "weights", id: string) {
  await db.delete(store, id);
}

// ---------- Documentos (MUDANCAS-V2 §5) — nunca entram no Diário, nos Álbuns ou em links ----------

export async function addDocument(db: Db, meta: DocumentMetaInput, file: ProcessedDocument): Promise<HealthDocument> {
  const data = parse(DocumentMetaSchema, meta);
  const dogId = await currentDogId(db);
  const tx = db.transaction(["documents", "documentFiles"], "readwrite");
  if ((await tx.objectStore("documents").count()) >= LIMITS.maxDocuments) {
    return fail(tx, new DomainError("DOC_QUOTA", `Cabem até ${LIMITS.maxDocuments} documentos nesta versão de teste. Exclua algum para guardar outro.`));
  }
  const doc: HealthDocument = { ...data, id: newId(), dogId, mime: file.mime, bytes: file.bytes, hasThumb: !!file.thumb, createdAt: now(), updatedAt: now() };
  await tx.objectStore("documents").put(doc);
  await tx.objectStore("documentFiles").put({ id: doc.id, file: file.file, thumb: file.thumb });
  await tx.done;
  return doc;
}

export async function updateDocument(db: Db, id: string, meta: DocumentMetaInput): Promise<HealthDocument> {
  const data = parse(DocumentMetaSchema, meta);
  const prev = await db.get("documents", id);
  if (!prev) throw new DomainError("NOT_FOUND", "Documento não encontrado.");
  const next = { ...prev, ...data, updatedAt: now() };
  await db.put("documents", next);
  return next;
}

export const getDocumentFile = (db: Db, id: string) => db.get("documentFiles", id);

/** Exclui o documento e o arquivo, e tira os vínculos de vacinas e consultas. */
export async function deleteDocument(db: Db, id: string) {
  const tx = db.transaction(["documents", "documentFiles", "vaccines", "visits"], "readwrite");
  await tx.objectStore("documents").delete(id);
  await tx.objectStore("documentFiles").delete(id);
  for (const v of await tx.objectStore("vaccines").getAll()) {
    if (v.documentId === id) await tx.objectStore("vaccines").put({ ...v, documentId: null });
  }
  for (const v of await tx.objectStore("visits").getAll()) {
    if (v.documentIds.includes(id)) await tx.objectStore("visits").put({ ...v, documentIds: v.documentIds.filter((d) => d !== id) });
  }
  await tx.done;
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
    medals: snap.medals,
    customAlbums: snap.customAlbums,
    collectionAdvances: snap.collectionAdvances,
    xpTotal: snap.xpTotal,
    health: snap.health,
  };
}
