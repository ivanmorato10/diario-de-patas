/**
 * Operações do modo real (MUDANCAS-V2 §8). Cada uma recebe o usuário já autenticado.
 * Regras: posse sempre conferida pelo dono da sessão (nunca por id vindo do cliente); leituras pelo
 * cliente do usuário (RLS vale); escritas privilegiadas pelo admin com owner_id da sessão.
 * Mensagens de erro iguais às do modo demonstração.
 */
import { repeatRowId } from "./ids";
import "server-only";
import { z } from "zod";
import sharp from "sharp";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { COLLECTIONS } from "@/config/catalog";
import { LIMITS, fullDiaryParams, serverMaxEntries } from "@/config/business";
import { activeSpecials, buildHistory, generatePlan, swapInPlan, type DailyPlan } from "@/domain/cycle";
import { civilDateInTz, isCivilDate, isValidTimezone } from "@/domain/dates";
import { DocumentMetaSchema } from "@/domain/documents";
import {
  ContactSchema, EMPTY_HEALTH, HealthProfileSchema, MedicationSchema, VaccineSchema, VisitSchema, WeightSchema, firstIssue,
} from "@/domain/health";
import { missionById } from "@/domain/missions";
import type { CollectionAdvance, MissionCompletion, Medal } from "@/domain/types";
import { adminClient, HttpError } from "./supabase";
import { LOCALES, REGIONS, WEIGHT_UNITS, defaultRegion, defaultWeightUnit, isLocale, isRegion, isWeightUnit, type AppLocale } from "@/i18n/locale";
import { MESSAGES as MESSAGES_BY_LOCALE } from "@/i18n/messages";
import { localeOf, regionOf, requestLocale, translator } from "./i18n";
import { after } from "next/server";
import { studioCheckPhoto, studioCreateJob, studioJob, studioState } from "./studio";
import { sendAccountDeleted } from "./mailer";
import { attachReferral, confirmReferral, referralInfo } from "./referrals";
import { deleteLetter, saveLetter, setMyName, toggleBone, updateLetter } from "./letters";
import { checkPushSubscription, unreadCount, listNotifications, markNotificationsRead, notifyFamily, removePushSubscription, savePushSubscription, saveNativePush, setNotifyPrefs, testPush } from "./notify";
import { createPurchase, creditShop, fakePayPurchase, purchaseStatus } from "./payments";
import { appleConfirm, appleStore } from "./apple";
import { XP_MONTH_GOAL, xpMonthOf } from "@/config/credits";
import { STUDIO_DEFAULTS } from "@/config/studio";
import { achadinhosInfo } from "./amazon";
import { acceptInvite, createInvite, currentDog, familyInfo, forgetDog, leaveDiary, nameFromUser, removeMember, requireEditor, switchDog, updateMember } from "./family";
import {
  albumClientId, instanceKeyOf, toContact, toCustomAlbum, toDocument, toDog, toEntry, toHealthProfile, toMedication, toPlan, toProfile,
  toVaccine, toVisit, toWeight,
} from "./map";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctx = { user: User; supa: SupabaseClient };

const bad = (code: string, message: string, params?: Record<string, string | number>) => new HttpError(400, code, message, params);
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw bad("INVALID", firstIssue(r.error));
  return r.data;
}

async function q(p: PromiseLike<{ data: any; error: any }>): Promise<any> {
  const { data, error } = await p;
  if (error) {
    const msg = String(error.message ?? "");
    const known = /^(LOCKED|NOT_TODAY|OUT_OF_WINDOW|PHOTO_ALREADY_USED|ART_NOT_ALLOWED|NOT_FOUND|UNKNOWN_MISSION|DOC_QUOTA|FOREIGN_MEDIA)/.exec(msg);
    if (known) throw bad(known[1], MESSAGES[known[1]] ?? msg, known[1] === "DOC_QUOTA" ? { max: LIMITS.maxDocuments } : undefined);
    console.error("supabase:", error.code, msg);
    throw new HttpError(500, "SERVER", "errors.saveFailed");
  }
  return data;
}

/** Erros de regra que vêm do banco (exceções das funções SQL) → chave do texto. */
const MESSAGES: Record<string, string> = {
  LOCKED: "errors.locked",
  NOT_TODAY: "errors.notToday",
  OUT_OF_WINDOW: "errors.outOfWindow",
  PHOTO_ALREADY_USED: "errors.photoAlreadyUsedMission",
  ART_NOT_ALLOWED: "errors.artNotAllowed",
  NOT_FOUND: "errors.memoryNotFound",
  UNKNOWN_MISSION: "errors.unknownMission",
  DOC_QUOTA: "errors.docQuota",
  FOREIGN_MEDIA: "errors.foreignMedia",
};

async function profileOf({ supa, user }: Ctx) {
  return (await q(supa.from("profiles").select("*").eq("user_id", user.id).maybeSingle())) as any;
}
/** Diário aberto agora (vários cachorros e família): com o papel da pessoa em `role`. */
async function dogOf(ctx: Ctx, required = true): Promise<any> {
  return currentDog(ctx, required);
}
/** Diário aberto, exigindo que a pessoa possa editar (admin ou editor). */
async function editableDog(ctx: Ctx): Promise<any> {
  const d = await currentDog(ctx);
  requireEditor(d!);
  return d;
}
const todayOf = (profile: any) => civilDateInTz(new Date(), profile?.timezone ?? "America/Sao_Paulo");

// ---------- Álbuns ----------

/** Id do álbum no banco a partir do id do app; cria o álbum da coleção na primeira vez. */
async function albumRowId(ctx: Ctx, dogId: string, clientId: string): Promise<string | null> {
  const admin = adminClient();
  if (clientId.startsWith("custom-")) {
    const id = clientId.slice(7);
    const row = await q(ctx.supa.from("albums").select("id").eq("id", id).eq("dog_id", dogId).eq("type", "custom").maybeSingle());
    return row ? id : null;
  }
  const col = COLLECTIONS.find((c) => c.id === clientId);
  if (!col) return null;
  const found = (await q(admin.from("albums").select("id").eq("dog_id", dogId).eq("collection_id", col.id).maybeSingle())) as any;
  if (found) return found.id;
  const owner = (await dogOf(ctx)).owner_id;
  const created = (await q(admin.from("albums").upsert({ owner_id: owner, dog_id: dogId, collection_id: col.id, title: MESSAGES_BY_LOCALE["pt-BR"].catalog.collections[col.id].title.slice(0, 40), type: "collection" }, { onConflict: "dog_id,collection_id" }).select("id").single())) as any;
  return created.id;
}

async function setEntryAlbums(ctx: Ctx, dogId: string, entryId: string, clientIds: readonly string[], replace: boolean) {
  const ids = (await Promise.all([...new Set(clientIds)].map((c) => albumRowId(ctx, dogId, c)))).filter((x): x is string => !!x);
  if (replace) await q(ctx.supa.from("album_entries").delete().eq("entry_id", entryId).not("album_id", "in", `(${ids.length ? ids.join(",") : "00000000-0000-0000-0000-000000000000"})`));
  if (ids.length) await q(ctx.supa.from("album_entries").upsert(ids.map((album_id) => ({ album_id, entry_id: entryId })), { onConflict: "album_id,entry_id", ignoreDuplicates: true }));
}

// ---------- Snapshot ----------

async function ensurePlan(ctx: Ctx, dog: any, today: string): Promise<DailyPlan> {
  const admin = adminClient();
  const existing = (await q(admin.from("daily_plans").select("*").eq("dog_id", dog.id).eq("plan_date", today).maybeSingle())) as any;
  if (existing) return toPlan(existing);
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - 15 * 86_400_000).toISOString().slice(0, 10);
  const plans = ((await q(admin.from("daily_plans").select("*").eq("dog_id", dog.id).gte("plan_date", since))) as any[]).map(toPlan);
  const dailyDone = ((await q(admin.from("mission_instances").select("template_id, period_key, mission_completions!inner(id)").eq("dog_id", dog.id).gte("period_key", since).like("template_id", "D%"))) as any[])
    .map((r) => ({ missionId: r.template_id, date: r.period_key }));
  const plan = generatePlan(dog.id, today, toDog(dog).preferences, buildHistory(plans, dailyDone, today), now());
  const row = (await q(admin.from("daily_plans").upsert({ owner_id: dog.owner_id, dog_id: dog.id, plan_date: today, slots: plan.slots, swaps: plan.swaps, shown: plan.shown }, { onConflict: "dog_id,plan_date", ignoreDuplicates: true }).select("*"))) as any[];
  if (row[0]) return toPlan(row[0]);
  return toPlan(await q(admin.from("daily_plans").select("*").eq("dog_id", dog.id).eq("plan_date", today).single()));
}

/** Quem está usando: nome (confirmado ou só um palpite) para "Qual é o seu nome?". */
const meOf = (ctx: Ctx, profile: any) => {
  const meta = (ctx.user.user_metadata ?? {}) as any;
  // Palpite só quando o login traz um nome de verdade (Google/Apple); do email não sai um nome bom.
  const fromLogin = String(meta.full_name || meta.name || meta.given_name || "").trim().split(/\s+/)[0] ?? "";
  return {
    userId: ctx.user.id, name: (profile?.display_name as string) || nameFromUser(ctx.user), nameConfirmed: !!profile?.name_confirmed, suggestedName: fromLogin.slice(0, 40),
    notify: { photo: profile?.notify_photo !== false, letter: profile?.notify_letter !== false, bone: profile?.notify_bone !== false },
    locale: isLocale(profile?.locale) ? profile.locale : null, region: isRegion(profile?.region) ? profile.region : null, weightUnit: isWeightUnit(profile?.weight_unit) ? profile.weight_unit : null,
  };
};

/**
 * Idioma, região do calendário e unidade de peso da pessoa. O idioma também vai para os metadados do login
 * (user_metadata.locale): é o que os emails do Supabase Auth (código, confirmação, senha) usam para escolher o idioma.
 */
export async function setPreferences(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ locale: z.enum(LOCALES).optional(), region: z.enum(REGIONS).optional(), weightUnit: z.enum(WEIGHT_UNITS).optional() }), args);
  const row: any = { user_id: ctx.user.id };
  if (a.locale) row.locale = a.locale;
  if (a.region) row.region = a.region;
  if (a.weightUnit) row.weight_unit = a.weightUnit;
  // O idioma só SUGERE região e unidade, uma vez: a primeira gravação fixa as que faltam pelo idioma que valia
  // ANTES desta troca (perfil, ou o da tela). Depois disso, trocar o idioma não muda loja, compra, feriados nem kg/lb.
  const current = (await q(adminClient().from("profiles").select("locale, region, weight_unit").eq("user_id", ctx.user.id).maybeSingle())) as any;
  const base: AppLocale = isLocale(current?.locale) ? current.locale : await requestLocale();
  if (!isRegion(current?.region) && !row.region) row.region = defaultRegion(base);
  if (!isWeightUnit(current?.weight_unit) && !row.weight_unit) row.weight_unit = defaultWeightUnit(base);
  if (!isLocale(current?.locale) && !row.locale) row.locale = base;
  await q(adminClient().from("profiles").upsert(row, { onConflict: "user_id" }));
  if (a.locale && (ctx.user.user_metadata as any)?.locale !== a.locale) {
    const { error } = await adminClient().auth.admin.updateUserById(ctx.user.id, { user_metadata: { locale: a.locale } });
    if (error) console.error("idioma nos metadados do login:", error.message);
  }
  return {};
}

export async function snapshot(ctx: Ctx) {
  const { supa } = ctx;
  const [profile, dog] = await Promise.all([profileOf(ctx), dogOf(ctx, false)]); // independentes: ao mesmo tempo
  const today = todayOf(profile);
  if (!dog) {
    const fam = await familyInfo(ctx, null);
    return { profile: profile ? toProfile(profile) : null, me: meOf(ctx, profile), dog: null, role: null, diaries: fam.diaries, members: [], entries: [], albumEntries: [], completions: [], xpTotal: 0, xpMonth: 0, today, health: EMPTY_HEALTH, dailyPlan: null, collectionAdvances: [], medals: [], customAlbums: [] };
  }
  const D = dog.id;
  const [entries, albums, albumEntries, completions, xp, hp, weights, vaccines, visits, visitDocs, meds, contacts, docs, advances, medals, fam, letterRows, boneRows, unreadRes, plan] = await Promise.all([
    q(supa.from("diary_entries").select("*").eq("dog_id", D).is("deleted_at", null).order("occurred_date", { ascending: false }).order("created_at", { ascending: false })),
    q(supa.from("albums").select("*").eq("dog_id", D)),
    q(supa.from("album_entries").select("album_id, entry_id")),
    q(supa.from("mission_completions").select("id, completed_at, mission_instances!inner(template_id, period_key, dog_id), mission_submissions!mission_completions_accepted_submission_id_fkey(entry_id, id)").eq("mission_instances.dog_id", D)),
    q(supa.from("xp_ledger").select("amount, created_at").eq("dog_id", D)),
    q(supa.from("health_profiles").select("*").eq("dog_id", D).maybeSingle()),
    q(supa.from("weights").select("*").eq("dog_id", D).order("date").order("created_at")),
    q(supa.from("vaccines").select("*").eq("dog_id", D).order("applied_date", { ascending: false })),
    q(supa.from("visits").select("*").eq("dog_id", D).order("date", { ascending: false })),
    q(supa.from("visit_documents").select("*")),
    q(supa.from("medications").select("*").eq("dog_id", D).order("start_date", { ascending: false })),
    q(supa.from("contacts").select("*").eq("dog_id", D)),
    q(supa.from("documents").select("*").eq("dog_id", D).eq("status", "ready").order("created_at", { ascending: false })),
    q(supa.from("collection_advances").select("*").eq("dog_id", D)),
    q(supa.from("medals").select("*").eq("dog_id", D)),
    familyInfo(ctx, dog),
    q(supa.from("letters").select("*").eq("dog_id", D).order("letter_date", { ascending: false }).order("created_at", { ascending: false })),
    q(supa.from("bones").select("target_type, target_id, user_id").eq("dog_id", D)),
    supa.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id).is("read_at", null),
    ensurePlan(ctx, dog, today), // plano do dia junto com o resto (antes, só depois de tudo)
  ]) as any[];
  const memberName = new Map<string, string>((fam.members as any[]).map((m) => [m.userId, m.name]));
  const albumById = new Map<string, any>(albums.map((a: any) => [a.id, a]));
  const comps: MissionCompletion[] = completions.map((c: any) => {
    const inst = c.mission_instances;
    return {
      instanceKey: instanceKeyOf(dog.id, inst.template_id, inst.period_key), dogId: dog.id, missionId: inst.template_id,
      submissionId: c.mission_submissions?.id ?? c.id, mode: "owner", completedAt: c.completed_at, entryId: c.mission_submissions?.entry_id ?? undefined,
      date: /^\d{4}-\d{2}-\d{2}$/.test(inst.period_key) ? inst.period_key : undefined,
    };
  });
  const missionByEntry = new Map<string, string>();
  for (const c of comps) if (c.entryId && !missionByEntry.has(c.entryId)) missionByEntry.set(c.entryId, c.missionId);
  const docsByVisit = new Map<string, string[]>();
  const visitIds = new Set(visits.map((v: any) => v.id));
  for (const v of visitDocs.filter((x: any) => visitIds.has(x.visit_id))) docsByVisit.set(v.visit_id, [...(docsByVisit.get(v.visit_id) ?? []), v.document_id]);
  const order = ["emergency", "vet", "clinic", "sitter", "other"];
  return {
    profile: profile ? toProfile(profile) : null,
    dog: toDog(dog),
    role: dog.role,
    diaries: fam.diaries,
    members: fam.members,
    me: meOf(ctx, profile),
    entries: entries.map((e: any) => ({ ...toEntry(e, missionByEntry.get(e.id) ?? null), createdBy: e.created_by ?? null, createdByName: e.created_by && e.created_by !== ctx.user.id ? memberName.get(e.created_by) ?? null : null })),
    letters: letterRows.map((l: any) => ({ id: l.id, body: l.body, date: l.letter_date, createdBy: l.created_by, createdByName: l.created_by ? memberName.get(l.created_by) ?? null : null, mine: l.created_by === ctx.user.id, createdAt: l.created_at })),
    bones: boneRows.map((b: any) => ({ targetType: b.target_type, targetId: b.target_id, userId: b.user_id })),
    unread: unreadRes?.count ?? 0,
    albumEntries: albumEntries.filter((a: any) => albumById.has(a.album_id)).map((a: any) => {
      const albumId = albumClientId(albumById.get(a.album_id));
      return { key: `${albumId}:${a.entry_id}`, albumId, entryId: a.entry_id, addedAt: "" };
    }),
    completions: comps,
    xpTotal: xp.reduce((s: number, r: any) => s + r.amount, 0),
    xpMonth: xp.filter((r: any) => xpMonthOf(r.created_at) === xpMonthOf(new Date())).reduce((s: number, r: any) => s + r.amount, 0),
    today,
    health: {
      profile: hp ? toHealthProfile(hp) : null,
      weights: weights.map(toWeight),
      vaccines: vaccines.map(toVaccine),
      visits: visits.map((v: any) => toVisit(v, docsByVisit.get(v.id) ?? [])),
      medications: meds.map(toMedication),
      contacts: contacts.map(toContact).sort((a: any, b: any) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name, "pt-BR")),
      documents: docs.map(toDocument),
    },
    dailyPlan: plan,
    collectionAdvances: advances.map((a: any): CollectionAdvance => ({ key: `${dog.id}:${a.item_id}`, dogId: dog.id, itemId: a.item_id, entryId: a.entry_id, viaMissionId: a.via_mission_id, createdAt: a.created_at })),
    medals: medals.map((m: any): Medal => ({ key: `${dog.id}:${m.set_id}`, dogId: dog.id, setId: m.set_id, createdAt: m.created_at })),
    customAlbums: albums.filter((a: any) => a.type === "custom").map(toCustomAlbum).sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt)),
  };
}

// ---------- Perfil e cachorro ----------

const Prefs = z.object({ home: z.boolean(), outdoor: z.boolean(), socialDogs: z.boolean(), people: z.boolean() });
const civil = z.string().refine(isCivilDate, "errors.invalidDate");

async function ensureProfile(ctx: Ctx, timezone?: string) {
  const tz = timezone && isValidTimezone(timezone) ? timezone : "America/Sao_Paulo";
  let p = await profileOf(ctx);
  if (!p) {
    // Conta nova: outra operação da abertura (ex.: gravar o idioma) pode criar o perfil ao mesmo tempo. Quem chegar
    // depois usa o que já existe, sem erro (antes, "chave duplicada" fazia o primeiro diário não ser criado).
    await q(ctx.supa.from("profiles").upsert({ user_id: ctx.user.id, timezone: tz, display_name: nameFromUser(ctx.user) }, { onConflict: "user_id", ignoreDuplicates: true }));
    p = await profileOf(ctx);
  }
  if (!p) return;
  const patch: Record<string, string> = {};
  if (!p.display_name) patch.display_name = nameFromUser(ctx.user);
  if (timezone && p.timezone !== tz) patch.timezone = tz;
  if (Object.keys(patch).length) await q(ctx.supa.from("profiles").update(patch).eq("user_id", ctx.user.id));
}

/** A mídia precisa ser do próprio dono e estar pronta (bytes já inspecionados). */
async function readyMedia(ctx: Ctx, id: string) {
  const m = (await q(ctx.supa.from("media_assets").select("id, status, kind").eq("id", id).maybeSingle())) as any;
  if (!m || m.status !== "ready") throw bad("NOT_FOUND", "errors.photoNotFoundResend");
  return m;
}

export async function createDiary(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ timezone: z.string(), name: z.string(), nickname: z.string().nullable().optional(), birthDate: civil.nullable(), preferences: Prefs, another: z.boolean().optional() }), args);
  const name = a.name.trim().slice(0, LIMITS.dogNameMaxChars);
  if (!name) throw bad("NAME_REQUIRED", "errors.dogNameRequired");
  await ensureProfile(ctx, a.timezone);
  const existing = await dogOf(ctx, false);
  if (existing && !a.another) return toDog(existing); // retry do primeiro diário: o mesmo
  const nickname = a.nickname?.replace(/\s+/g, " ").trim().slice(0, 30) || null;
  const created = await q(ctx.supa.from("dogs").insert({ owner_id: ctx.user.id, name, nickname, birth_date: a.birthDate, preferences_json: a.preferences }).select("*").single()) as any;
  const admin = adminClient();
  await q(admin.from("profiles").update({ current_dog_id: created.id }).eq("user_id", ctx.user.id));
  // 1 crédito de boas-vindas: uma vez por pessoa, no primeiro diário criado.
  await q(admin.rpc("grant_welcome_credits", { p_owner: ctx.user.id, p_dog: created.id, p_amount: Number(process.env.STUDIO_TEST_CREDITS || STUDIO_DEFAULTS.testCredits) }));
  if (!existing) await attachReferral(ctx); // primeiro diário de alguém que chegou por indicação
  forgetDog(ctx);
  return toDog(created);
}

export async function updateDog(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ name: z.string().optional(), nickname: z.string().nullable().optional(), birthDate: civil.nullable().optional(), preferences: Prefs.optional(), photoMediaId: z.string().uuid().nullable().optional(),
    avatarCrop: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), zoom: z.number().min(1).max(3) }).nullable().optional() }), args);
  const dog = await editableDog(ctx);
  const patch: any = {};
  if (a.name !== undefined) {
    const n = a.name.trim().slice(0, LIMITS.dogNameMaxChars);
    if (!n) throw bad("NAME_REQUIRED", "errors.nameEmpty");
    patch.name = n;
  }
  if (a.birthDate !== undefined) patch.birth_date = a.birthDate;
  if (a.nickname !== undefined) patch.nickname = a.nickname?.replace(/\s+/g, " ").trim().slice(0, 30) || null;
  if (a.preferences) patch.preferences_json = a.preferences;
  if (a.avatarCrop !== undefined) patch.avatar_crop = a.avatarCrop;
  if (a.photoMediaId !== undefined) {
    if (a.photoMediaId) await readyMedia(ctx, a.photoMediaId);
    patch.photo_asset_id = a.photoMediaId;
    if (a.avatarCrop === undefined) patch.avatar_crop = null; // foto nova: começa centralizada
  }
  // Primeiro grava a foto nova; só depois descarta a antiga (se a gravação falhar, a antiga continua).
  const updated = toDog(await q(ctx.supa.from("dogs").update(patch).eq("id", dog.id).select("*").single()));
  const old = dog.photo_asset_id as string | null;
  if (a.photoMediaId !== undefined && old && old !== a.photoMediaId) {
    // Não apaga se a mesma mídia ainda é usada por uma lembrança do diário.
    const { count } = await adminClient().from("diary_entries").select("id", { count: "exact", head: true }).eq("media_asset_id", old).is("deleted_at", null);
    if (!count) await discardMedia(ctx, old);
  }
  return updated;
}

export async function updateTimezone(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ timezone: z.string().refine(isValidTimezone, "errors.invalidTimezone") }), args);
  await ensureProfile(ctx, a.timezone);
  return {};
}

// ---------- Lembranças ----------

export async function entryByRequestKey(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ requestKey: z.string().uuid() }), args);
  const dog = await dogOf(ctx);
  const e = (await q(ctx.supa.from("diary_entries").select("*").eq("dog_id", dog.id).eq("request_key", a.requestKey).is("deleted_at", null).maybeSingle())) as any;
  return e ? { entry: toEntry(e, null) } : null;
}

export async function findEntryByHash(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ hash: z.string().max(128) }), args);
  const dog = await dogOf(ctx);
  const media = (await q(ctx.supa.from("media_assets").select("id").eq("dog_id", dog.id).eq("hash", a.hash).eq("status", "ready"))) as any[];
  if (!media.length) return null;
  const e = (await q(ctx.supa.from("diary_entries").select("*").eq("dog_id", dog.id).in("media_asset_id", media.map((m) => m.id)).is("deleted_at", null).limit(1))) as any[];
  return e[0] ? toEntry(e[0], null) : null;
}

export async function saveEntry(ctx: Ctx, args: unknown) {
  const a = parse(z.object({
    requestKey: z.string().uuid(), mediaId: z.string().uuid(), caption: z.string(), occurredDate: civil, source: z.enum(["free", "mission", "studio"]),
    albumIds: z.array(z.string()).max(60), kind: z.enum(["photo", "art"]).optional(),
  }), args);
  const dog = await editableDog(ctx);
  const profile = await profileOf(ctx);
  if (a.occurredDate > todayOf(profile)) throw bad("INVALID", "errors.dateUpToToday");
  const prior = (await q(ctx.supa.from("diary_entries").select("*").eq("dog_id", dog.id).eq("request_key", a.requestKey).maybeSingle())) as any;
  if (prior) return toEntry(prior, null); // retry: mesma lembrança
  const { count } = await ctx.supa.from("diary_entries").select("id", { count: "exact", head: true }).eq("dog_id", dog.id).is("deleted_at", null);
  if ((count ?? 0) >= serverMaxEntries()) throw bad("STORAGE_QUOTA", "errors.fullDiary", fullDiaryParams(dog.name));
  await readyMedia(ctx, a.mediaId);
  const used = (await q(ctx.supa.from("diary_entries").select("id").eq("dog_id", dog.id).eq("media_asset_id", a.mediaId).limit(1))) as any[];
  if (used.length) throw bad("INVALID", "errors.photoAlreadyUsed");
  const ins = await adminClient().from("diary_entries").insert({
    owner_id: dog.owner_id, created_by: ctx.user.id, dog_id: dog.id, media_asset_id: a.mediaId, caption: a.caption.trim().slice(0, LIMITS.captionMaxChars),
    occurred_date: a.occurredDate, timezone: profile?.timezone ?? "America/Sao_Paulo", source: a.source === "mission" ? "free" : a.source, request_key: a.requestKey,
  }).select("*").single();
  // Rede de segurança do banco: duas gravações ao mesmo tempo não passam do limite.
  if (ins.error) {
    if (/STORAGE_QUOTA/.test(ins.error.message)) throw bad("STORAGE_QUOTA", "errors.fullDiary", fullDiaryParams(dog.name));
    console.error("saveEntry:", ins.error.message);
    throw new HttpError(500, "SERVER", "errors.savePhotoFailed");
  }
  const row = ins.data as any;
  await setEntryAlbums(ctx, dog.id, row.id, a.albumIds, false);
  if (dog.owner_id === ctx.user.id) await confirmReferral(ctx); // primeira foto no próprio diário confirma a indicação
  notifyFamily(ctx, { dogId: dog.id, dogName: dog.name, kind: "photo", targetType: "entry", targetId: row.id });
  return toEntry(row, null);
}

export async function updateEntry(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ id: z.string().uuid(), caption: z.string().optional(), occurredDate: civil.optional(), albumIds: z.array(z.string()).max(60).optional() }), args);
  const dog = await editableDog(ctx);
  const patch: any = {};
  if (a.caption !== undefined) patch.caption = a.caption.trim().slice(0, LIMITS.captionMaxChars);
  if (a.occurredDate !== undefined) {
    if (a.occurredDate > todayOf(await profileOf(ctx))) throw bad("INVALID", "errors.dateUpToToday");
    patch.occurred_date = a.occurredDate;
  }
  const rows = (await q(ctx.supa.from("diary_entries").update(patch).eq("id", a.id).eq("dog_id", dog.id).is("deleted_at", null).select("*"))) as any[];
  if (!rows[0]) throw bad("NOT_FOUND", "errors.memoryNotFoundShort");
  if (a.albumIds) await setEntryAlbums(ctx, dog.id, a.id, a.albumIds, true);
  return toEntry(rows[0], null);
}

/** Mídia descartada: some da UI na hora e entra na fila de limpeza do bucket. */
async function discardMedia(ctx: Ctx, mediaId: string) {
  const admin = adminClient();
  const dog = await dogOf(ctx);
  const m = (await q(admin.from("media_assets").select("*").eq("id", mediaId).eq("dog_id", dog.id).maybeSingle())) as any;
  if (!m) return;
  await q(admin.from("media_assets").update({ status: "deleted" }).eq("id", m.id));
  await q(admin.from("storage_cleanup").insert([m.private_storage_key, m.thumb_storage_key].filter(Boolean).map((k: string) => ({ bucket: "media", object_key: k, reason: "entry_deleted" }))));
}

export async function deleteEntry(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ id: z.string().uuid() }), args);
  const dog = await editableDog(ctx);
  const e = (await q(ctx.supa.from("diary_entries").select("id, media_asset_id").eq("id", a.id).eq("dog_id", dog.id).is("deleted_at", null).maybeSingle())) as any;
  if (!e) return {};
  const admin = adminClient();
  // Conquista e XP permanecem; a foto sai do diário, dos álbuns e dos links (§9).
  await q(admin.from("diary_entries").update({ deleted_at: now() }).eq("id", e.id).eq("dog_id", dog.id));
  await q(admin.from("album_entries").delete().eq("entry_id", e.id));
  await q(admin.from("share_link_entries").delete().eq("entry_id", e.id));
  await discardMedia(ctx, e.media_asset_id);
  return {};
}

// ---------- Álbuns da pessoa ----------

const albumTitle = (t: string) => {
  const title = t.trim().replace(/\s+/g, " ").slice(0, LIMITS.albumTitleMaxChars);
  if (!title) throw bad("INVALID", "errors.albumNameRequired");
  return title;
};
const customUuid = (id: string) => {
  if (!id.startsWith("custom-")) throw bad("NOT_FOUND", "errors.albumNotFound");
  return id.slice(7);
};

export async function createAlbum(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ title: z.string(), key: RepeatKey }), args);
  const dog = await editableDog(ctx);
  if (a.key) {
    const already = (await ctx.supa.from("albums").select("*").eq("id", repeatRowId(dog.id, "albums", a.key)).eq("dog_id", dog.id).maybeSingle()).data;
    if (already) return toCustomAlbum(already); // repetição: o álbum já foi criado
  }
  const { count } = await ctx.supa.from("albums").select("id", { count: "exact", head: true }).eq("dog_id", dog.id).eq("type", "custom");
  if ((count ?? 0) >= LIMITS.maxCustomAlbums) throw bad("ALBUM_QUOTA", "errors.albumQuota", { max: LIMITS.maxCustomAlbums });
  return toCustomAlbum(await insertOnce(ctx, "albums", { owner_id: dog.owner_id, dog_id: dog.id, title: albumTitle(a.title), type: "custom" }, a.key, dog.id));
}

export async function renameAlbum(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ id: z.string(), title: z.string() }), args);
  const dog = await editableDog(ctx);
  const rows = (await q(ctx.supa.from("albums").update({ title: albumTitle(a.title) }).eq("id", customUuid(a.id)).eq("dog_id", dog.id).eq("type", "custom").select("*"))) as any[];
  if (!rows[0]) throw bad("NOT_FOUND", "errors.albumNotFound");
  return toCustomAlbum(rows[0]);
}

export async function deleteAlbum(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ id: z.string() }), args);
  const dog = await editableDog(ctx);
  await q(ctx.supa.from("albums").delete().eq("id", customUuid(a.id)).eq("dog_id", dog.id).eq("type", "custom"));
  return {};
}

export async function addEntriesToAlbum(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ albumId: z.string(), entryIds: z.array(z.string().uuid()).max(LIMITS.maxEntries) }), args);
  const dog = await editableDog(ctx);
  const albumId = await albumRowId(ctx, dog.id, a.albumId);
  if (!albumId) throw bad("NOT_FOUND", "errors.albumNotFound");
  const own = (await q(ctx.supa.from("diary_entries").select("id").eq("dog_id", dog.id).in("id", [...new Set(a.entryIds)]).is("deleted_at", null))) as any[];
  if (own.length) await q(ctx.supa.from("album_entries").upsert(own.map((e) => ({ album_id: albumId, entry_id: e.id })), { onConflict: "album_id,entry_id", ignoreDuplicates: true }));
  return {};
}

// ---------- Missões (servidor é a autoridade) ----------

export async function submitMission(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ requestKey: z.string().uuid(), missionId: z.string(), entryId: z.string().uuid(), status: z.enum(["approved", "uncertain", "not_matched", "pending", "technical_failure"]) }).passthrough(), args);
  const mission = missionById(a.missionId);
  if (!mission) throw bad("UNKNOWN_MISSION", MESSAGES.UNKNOWN_MISSION);
  const dog = await editableDog(ctx);
  const profile = await profileOf(ctx);
  const today = todayOf(profile);
  let period: string | null = null;
  if (mission.kind === "special") {
    // Janela pela região do calendário de quem envia; a recompensa continua uma por cachorro e ano.
    const w = activeSpecials(today, dog.birth_date, regionOf(profile)).find((x) => x.mission.id === mission.id);
    if (!w) throw bad("OUT_OF_WINDOW", MESSAGES.OUT_OF_WINDOW);
    period = w.occurrence;
  }
  if (mission.kind === "daily") await ensurePlan(ctx, dog, today);
  const admin = adminClient();
  const advItem = mission.advancesItem;
  const advBefore = advItem ? await q(admin.from("collection_advances").select("item_id").eq("dog_id", dog.id).eq("item_id", advItem).maybeSingle()) : null;
  const res = (await q(admin.rpc("confirm_mission", {
    p_owner: dog.owner_id, p_dog: dog.id, p_template: mission.id, p_entry: a.entryId, p_request_key: a.requestKey,
    p_approved: a.status === "approved", p_today: today, p_period: period,
  }))) as any[];
  const r = res[0] ?? { xp_awarded: 0, already_completed: true, medals: [] };
  const advAfter = advItem && !advBefore ? await q(admin.from("collection_advances").select("item_id, via_mission_id").eq("dog_id", dog.id).eq("item_id", advItem).maybeSingle()) as any : null;
  const approved = a.status === "approved";
  // Recompensa: cada 200 XP de missões vira 1 crédito do Estúdio (idempotente por marco).
  // Arte do mês: 200 XP no mês liberam 1 crédito, uma única vez por mês (idempotente no banco).
  const creditsEarned = approved && r.xp_awarded > 0 && (await q(admin.rpc("grant_monthly_xp_credit_dog", { p_dog: dog.id, p_goal: XP_MONTH_GOAL }))) ? 1 : 0;
  // Foto aprovada entra no álbum da missão (igual ao modo demo).
  if (approved) await setEntryAlbums(ctx, dog.id, a.entryId, [mission.collectionId], false);
  const instanceKey = instanceKeyOf(dog.id, mission.id, mission.kind === "daily" ? today : period ?? "once");
  return {
    submission: { id: a.requestKey, requestKey: a.requestKey, missionId: mission.id, dogId: dog.id, entryId: a.entryId, status: approved ? "approved" : "uncertain", reasonCode: approved ? "OWNER_CONFIRMED" : "OWNER_UNSURE", mode: "owner", providerVersion: null, createdAt: now() },
    completion: approved ? { instanceKey, dogId: dog.id, missionId: mission.id, submissionId: a.requestKey, mode: "owner", completedAt: now(), entryId: a.entryId } : null,
    xpAwarded: r.xp_awarded, alreadyCompleted: approved && r.already_completed, medals: r.medals ?? [],
    advancedItem: advAfter && advAfter.via_mission_id === mission.id ? advItem : undefined,
    creditsEarned,
  };
}

export async function swapDaily(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ slot: z.enum(["A", "B", "C"]) }), args);
  const dog = await editableDog(ctx);
  const today = todayOf(await profileOf(ctx));
  const admin = adminClient();
  const plan = await ensurePlan(ctx, dog, today);
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - 15 * 86_400_000).toISOString().slice(0, 10);
  const plans = ((await q(admin.from("daily_plans").select("*").eq("dog_id", dog.id).gte("plan_date", since))) as any[]).map(toPlan);
  const next = swapInPlan(plan, a.slot, toDog(dog).preferences, buildHistory(plans, [], today));
  await q(admin.from("daily_plans").update({ slots: next.slots, swaps: next.swaps, shown: next.shown }).eq("dog_id", dog.id).eq("plan_date", today));
  return next;
}

// ---------- Cuidados ----------

const CARE = {
  vaccines: { schema: VaccineSchema, row: (d: any) => ({ kind: d.kind, name: d.name, applied_date: d.appliedDate, next_date: d.nextDate, clinic: d.clinic, document_id: d.documentId }) },
  visits: { schema: VisitSchema, row: (d: any) => ({ date: d.date, time: d.time ?? "", clinic: d.clinic, vet: d.vet, reason: d.reason, notes: d.notes, next_date: d.nextDate }) },
  medications: { schema: MedicationSchema, row: (d: any) => ({ name: d.name, dose: d.dose, frequency: d.frequency, repeat: d.repeat, last_given: d.lastGiven, start_date: d.startDate, end_date: d.endDate, notes: d.notes }) },
  contacts: { schema: ContactSchema, row: (d: any) => ({ kind: d.kind, name: d.name, phone: d.phone, address: d.address, notes: d.notes }) },
} as const;

export async function saveHealthProfile(ctx: Ctx, args: unknown) {
  const d = parse(HealthProfileSchema, args);
  const dog = await editableDog(ctx);
  return toHealthProfile(await q(ctx.supa.from("health_profiles").upsert({ dog_id: dog.id, owner_id: dog.owner_id, ...d, updated_at: now() }).select("*").single()));
}

/** Chave de repetição opcional (UUID) que o app manda nas criações. */
const RepeatKey = z.string().uuid().optional();

/**
 * Criação que pode ser repetida sem duplicar: o app manda um id estável (`key`); se o registro já existe (a primeira
 * tentativa gravou, mas a resposta se perdeu), devolve o mesmo em vez de criar outro. Sem `key`, cria normalmente.
 */
async function insertOnce(ctx: Ctx, table: string, row: Record<string, unknown>, key: string | undefined, dogId: string) {
  const id = key ? repeatRowId(dogId, table, key) : undefined; // a chave só vale dentro deste cachorro e tabela
  const existing = async () => (id ? ((await ctx.supa.from(table).select("*").eq("id", id).eq("dog_id", dogId).maybeSingle()).data as any) : null);
  const before = await existing();
  if (before) return before;
  const { data, error } = await ctx.supa.from(table).insert(id ? { ...row, id } : row).select("*").single();
  if (error?.code === "23505" && id) {
    const again = await existing(); // duas tentativas ao mesmo tempo: vale a que gravou
    if (again) return again;
  }
  return q(Promise.resolve({ data, error }));
}

export async function addWeight(ctx: Ctx, args: unknown) {
  const d = parse(WeightSchema, args);
  const key = parse(RepeatKey, (args as { key?: unknown } | null)?.key);
  const dog = await editableDog(ctx);
  return toWeight(await insertOnce(ctx, "weights", { owner_id: dog.owner_id, dog_id: dog.id, date: d.date, kg: d.kg }, key, dog.id));
}

export async function saveCare(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ store: z.enum(["vaccines", "visits", "medications", "contacts"]), input: z.unknown(), id: z.string().uuid().optional(), key: RepeatKey }), args);
  const def = CARE[a.store];
  const data = parse(def.schema as z.ZodType<any>, a.input);
  const dog = await editableDog(ctx);
  if (a.store === "vaccines" && data.documentId) await ownDocument(ctx, data.documentId);
  const row = { ...def.row(data), updated_at: now() };
  const saved = a.id
    ? ((await q(ctx.supa.from(a.store).update(row).eq("id", a.id).eq("dog_id", dog.id).select("*"))) as any[])[0]
    : await insertOnce(ctx, a.store, { ...row, owner_id: dog.owner_id, dog_id: dog.id }, a.key, dog.id);
  if (!saved) throw bad("NOT_FOUND", "errors.recordNotFound");
  if (a.store === "visits") {
    const ids: string[] = data.documentIds ?? [];
    for (const id of ids) await ownDocument(ctx, id);
    await q(ctx.supa.from("visit_documents").delete().eq("visit_id", saved.id));
    if (ids.length) await q(ctx.supa.from("visit_documents").insert(ids.map((document_id) => ({ visit_id: saved.id, document_id }))));
    return toVisit(saved, ids);
  }
  // No formato da tela: o app já coloca o registro salvo na lista, sem esperar recarregar tudo.
  return a.store === "vaccines" ? toVaccine(saved) : a.store === "medications" ? toMedication(saved) : toContact(saved);
}

export async function deleteCare(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ store: z.enum(["vaccines", "visits", "medications", "contacts", "weights"]), id: z.string().uuid() }), args);
  const dog = await editableDog(ctx);
  await q(ctx.supa.from(a.store).delete().eq("id", a.id).eq("dog_id", dog.id));
  return {};
}

// ---------- Documentos ----------

async function ownDocument(ctx: Ctx, id: string) {
  const dog = await dogOf(ctx);
  const d = (await q(ctx.supa.from("documents").select("*").eq("id", id).eq("dog_id", dog.id).maybeSingle())) as any;
  if (!d || d.status === "deleted") throw bad("NOT_FOUND", "errors.documentNotFound");
  return d;
}

export async function getDocument(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ id: z.string().uuid() }), args);
  return toDocument(await ownDocument(ctx, a.id));
}

export async function updateDocument(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ id: z.string().uuid(), meta: z.unknown() }), args);
  const m = parse(DocumentMetaSchema, a.meta);
  await editableDog(ctx);
  await ownDocument(ctx, a.id);
  return toDocument(await q(ctx.supa.from("documents").update({ title: m.title, category: m.category, doc_date: m.docDate, expires_on: m.expiresOn, notes: m.notes, updated_at: now() }).eq("id", a.id).select("*").single()));
}

export async function deleteDocument(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ id: z.string().uuid() }), args);
  const dog = await editableDog(ctx);
  const d = await ownDocument(ctx, a.id).catch(() => null);
  if (!d) return {};
  const admin = adminClient();
  await q(admin.from("storage_cleanup").insert([d.private_storage_key, d.thumb_storage_key].filter(Boolean).map((k: string) => ({ bucket: "documents", object_key: k, reason: "document_deleted" }))));
  await q(admin.from("documents").delete().eq("id", d.id).eq("dog_id", dog.id)); // vacinas: set null; consultas: cascata
  return {};
}

// ---------- Uploads: URL assinada → inspeção dos bytes no servidor → pronto ----------

const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export async function createUpload(ctx: Ctx, args: unknown) {
  const a = parse(z.object({
    kind: z.enum(["media", "document"]), mime: z.string(), sizes: z.record(z.string(), z.number().int().nonnegative()),
    width: z.number().int().positive().optional(), height: z.number().int().positive().optional(), hash: z.string().max(128).optional(), mediaKind: z.enum(["photo", "art"]).optional(),
    title: z.string().optional(), category: z.string().optional(), docDate: z.string().nullable().optional(), expiresOn: z.string().nullable().optional(), notes: z.string().optional(),
  }), args);
  for (const s of Object.values(a.sizes)) if (s > LIMITS.maxUploadBytes) throw bad("TOO_LARGE", "errors.fileTooLarge", { mb: LIMITS.maxUploadBytes / 1024 / 1024 });
  const dog = await editableDog(ctx);
  const admin = adminClient();
  const id = uuid();
  const base = `${ctx.user.id}/${id}`;
  if (a.kind === "media") {
    if (!(IMAGE_MIME as readonly string[]).includes(a.mime) || !a.width || !a.height || !a.hash) throw bad("UNSUPPORTED", "errors.notAPhoto");
    const key = `${base}.${EXT[a.mime]}`, thumb = `${base}-thumb.${EXT[a.mime]}`;
    await q(admin.from("media_assets").insert({ id, owner_id: dog.owner_id, dog_id: dog.id, private_storage_key: key, thumb_storage_key: thumb, mime: a.mime, bytes: Math.max(1, a.sizes.display ?? 1), width: a.width, height: a.height, hash: a.hash, kind: a.mediaKind ?? "photo", status: "pending_upload" }));
    return { id, bucket: "media", uploads: await Promise.all([["display", key], ["thumb", thumb]].map(async ([variant, path]) => ({ variant, path, token: (await q(admin.storage.from("media").createSignedUploadUrl(path)) as any).token }))) };
  }
  const meta = parse(DocumentMetaSchema, { title: a.title, category: a.category, docDate: a.docDate ?? null, expiresOn: a.expiresOn ?? null, notes: a.notes ?? "" });
  if (!["application/pdf", ...IMAGE_MIME].includes(a.mime)) throw bad("UNSUPPORTED", "errors.notPdfOrImage");
  const key = `${base}.${EXT[a.mime]}`;
  const thumb = a.sizes.thumb ? `${base}-thumb.${a.mime === "application/pdf" ? "webp" : EXT[a.mime]}` : null;
  await q(admin.from("documents").insert({ id, owner_id: dog.owner_id, dog_id: dog.id, title: meta.title, category: meta.category, doc_date: meta.docDate, expires_on: meta.expiresOn, notes: meta.notes, private_storage_key: key, thumb_storage_key: thumb, mime: a.mime, bytes: Math.max(1, a.sizes.file ?? 1), status: "pending_upload" }));
  const targets: [string, string][] = [["file", key], ...(thumb ? [["thumb", thumb] as [string, string]] : [])];
  return { id, bucket: "documents", uploads: await Promise.all(targets.map(async ([variant, path]) => ({ variant, path, token: (await q(admin.storage.from("documents").createSignedUploadUrl(path)) as any).token }))) };
}

/** Confere o que chegou no bucket: tipo real pelos bytes (sharp / %PDF), tamanho e pixels. Recusa → apaga. */
export async function confirmUpload(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ kind: z.enum(["media", "document"]), id: z.string().uuid() }), args);
  const admin = adminClient();
  const table = a.kind === "media" ? "media_assets" : "documents";
  const bucket = a.kind === "media" ? "media" : "documents";
  const dog = await editableDog(ctx);
  const row = (await q(admin.from(table).select("*").eq("id", a.id).eq("dog_id", dog.id).maybeSingle())) as any;
  if (!row) throw bad("NOT_FOUND", "errors.uploadNotFound");
  if (row.status === "ready") return { ok: true };
  const reject = async (message: string) => {
    await admin.storage.from(bucket).remove([row.private_storage_key, row.thumb_storage_key].filter(Boolean));
    await admin.from(table).delete().eq("id", row.id);
    throw bad("UNSUPPORTED", message);
  };
  const download = async (path: string) => {
    const { data, error } = await admin.storage.from(bucket).download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  };
  const inspectImage = async (buf: Buffer | null) => {
    if (!buf || buf.length > LIMITS.maxUploadBytes) return null;
    try {
      const m = await sharp(buf, { limitInputPixels: LIMITS.maxUploadPixels }).metadata();
      return m.format && ["jpeg", "png", "webp"].includes(m.format) && m.width && m.height ? m : null;
    } catch {
      return null;
    }
  };
  const main = await download(row.private_storage_key);
  if (!main) return reject("errors.fileMissing");
  if (a.kind === "media") {
    const m = await inspectImage(main);
    const t = row.thumb_storage_key ? await inspectImage(await download(row.thumb_storage_key)) : null;
    if (!m || !t) return reject("errors.notAPhoto");
    await q(admin.from("media_assets").update({ status: "ready", bytes: main.length, width: m.width, height: m.height }).eq("id", row.id));
  } else {
    const isPdf = row.mime === "application/pdf";
    if (isPdf ? main.subarray(0, 5).toString("latin1") !== "%PDF-" : !(await inspectImage(main))) return reject(isPdf ? "errors.notPdf" : "errors.notImage");
    if (row.thumb_storage_key && !(await inspectImage(await download(row.thumb_storage_key)))) return reject("errors.badThumb");
    await q(admin.from("documents").update({ status: "ready", bytes: main.length }).eq("id", row.id)); // gatilho de cota: 50 por cachorro
  }
  return { ok: true };
}

export async function exportMetadata(ctx: Ctx) {
  const s = await snapshot(ctx);
  return { exportedAt: now(), mode: "conta", profile: s.profile, dog: s.dog && { ...s.dog, photoMediaId: undefined }, entries: s.entries.map(({ requestKey: _r, ...e }: any) => e), albums: s.albumEntries, customAlbums: s.customAlbums, achievements: s.completions, medals: s.medals, collectionAdvances: s.collectionAdvances, xpTotal: s.xpTotal, health: s.health };
}

/** Apagar só um diário (um cachorro): só o responsável, confirmando o nome. Vale para a família toda. */
export async function deleteDiary(ctx: Ctx, args: unknown) {
  const { confirmName } = parse(z.object({ confirmName: z.string() }), args);
  const dog = await dogOf(ctx);
  if (dog.role !== "admin") throw new HttpError(403, "ADMIN_ONLY", "errors.adminOnlyDelete");
  if (confirmName.trim() !== dog.name) throw bad("CONFIRM", "errors.confirmName", { dog: dog.name });
  const admin = adminClient();
  await q(admin.rpc("prepare_dog_deletion", { p_dog: dog.id }));
  await processCleanup(500);
  await q(admin.from("dogs").delete().eq("id", dog.id));
  forgetDog(ctx);
  return {};
}

/** Exclusão de conta (§8.2): corta acesso, revoga links, cancela jobs e apaga os arquivos dos buckets. */
export async function deleteAccount(ctx: Ctx) {
  const admin = adminClient();
  const dog = (((await admin.from("dogs").select("name").eq("owner_id", ctx.user.id).order("created_at").limit(1)).data ?? []) as { name: string }[])[0]?.name ?? null;
  const locale = await localeOf(ctx.user.id); // antes de apagar o perfil: o email de despedida vai no idioma da pessoa
  await q(admin.rpc("prepare_account_deletion", { p_owner: ctx.user.id }));
  await processCleanup(500);
  const { error } = await admin.auth.admin.deleteUser(ctx.user.id);
  if (error) throw new HttpError(500, "SERVER", "errors.deleteAccountFailed");
  await ctx.supa.auth.signOut().catch(() => undefined);
  if (ctx.user.email) await sendAccountDeleted(ctx.user.email, dog, locale);
  return {};
}

/** Esvazia a fila de limpeza dos buckets e descarta uploads abandonados há mais de 24 h. */
export async function processCleanup(limit = 200) {
  const admin = adminClient();
  const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  for (const [table, bucket] of [["media_assets", "media"], ["documents", "documents"]] as const) {
    const stale = ((await admin.from(table).select("id, private_storage_key, thumb_storage_key").eq("status", "pending_upload").lt("created_at", cutoff).limit(limit)).data ?? []) as any[];
    if (stale.length) {
      await admin.from("storage_cleanup").insert(stale.flatMap((r) => [r.private_storage_key, r.thumb_storage_key].filter(Boolean).map((k: string) => ({ bucket, object_key: k, reason: "orphan_upload" }))));
      await admin.from(table).delete().in("id", stale.map((r) => r.id));
    }
  }
  const jobs = ((await admin.from("storage_cleanup").select("*").is("done_at", null).lt("attempts", 10).order("created_at").limit(limit)).data ?? []) as any[];
  let removed = 0, failed = 0;
  for (const bucket of ["media", "documents"] as const) {
    const items = jobs.filter((j) => j.bucket === bucket);
    if (!items.length) continue;
    // Só marca como feito quando o armazenamento confirma. Arquivo que já não existe também conta como feito
    // (a remoção não devolve erro para ele). Com erro, fica na fila para nova tentativa.
    const { error } = await admin.storage.from(bucket).remove(items.map((j) => j.object_key));
    if (error) {
      failed += items.length;
      console.error("limpeza de arquivos falhou", bucket, error.message);
      await Promise.all(items.map((j) => admin.from("storage_cleanup").update({ attempts: (j.attempts ?? 0) + 1, last_error: error.message.slice(0, 300) }).eq("id", j.id)));
    } else {
      removed += items.length;
      await admin.from("storage_cleanup").update({ done_at: now(), attempts: 0, last_error: null }).in("id", items.map((j) => j.id));
    }
  }
  return { removed, failed };
}

// ---------- Links compartilhados (briefing §12) ----------
// Token aleatório (32 bytes) entregue uma única vez; no banco só o sha256. A página /s/:token
// mostra só a seleção, nunca saúde/documentos; revogar corta o acesso imediatamente.

export async function sha256hex(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Buffer.from(d).toString("hex");
}

export async function createShare(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ title: z.string(), entryIds: z.array(z.string().uuid()).min(1, "errors.pickOnePhoto").max(LIMITS.maxEntries) }), args);
  const title = a.title.trim().replace(/\s+/g, " ").slice(0, 60) || translator(await requestLocale())("shared.defaultTitle");
  const dog = await editableDog(ctx);
  const own = (await q(ctx.supa.from("diary_entries").select("id").eq("dog_id", dog.id).in("id", [...new Set(a.entryIds)]).is("deleted_at", null))) as any[];
  if (!own.length) throw bad("NOT_FOUND", "errors.photosNotFound");
  const { count } = await ctx.supa.from("share_links").select("id", { count: "exact", head: true }).eq("dog_id", dog.id).is("revoked_at", null);
  if ((count ?? 0) >= 20) throw bad("SHARE_QUOTA", "errors.shareQuota");
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const admin = adminClient();
  const link = (await q(admin.from("share_links").insert({ owner_id: dog.owner_id, dog_id: dog.id, token_hash: await sha256hex(token), title }).select("id").single())) as any;
  const order = new Map(a.entryIds.map((id, i) => [id, i]));
  await q(admin.from("share_link_entries").insert(own.map((e) => ({ share_link_id: link.id, entry_id: e.id, sort_order: order.get(e.id) ?? 0 }))));
  return { id: link.id, path: `/s/${token}` }; // o token só existe nesta resposta
}

export async function listShares(ctx: Ctx) {
  const dog = await dogOf(ctx);
  const rows = (await q(ctx.supa.from("share_links").select("id, title, created_at, revoked_at, share_link_entries(count)").eq("dog_id", dog.id).order("created_at", { ascending: false }))) as any[];
  return rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at, revokedAt: r.revoked_at, count: r.share_link_entries?.[0]?.count ?? 0 }));
}

export async function revokeShare(ctx: Ctx, args: unknown) {
  const a = parse(z.object({ id: z.string().uuid() }), args);
  const dog = await editableDog(ctx);
  const own = (await q(ctx.supa.from("share_links").select("id").eq("id", a.id).eq("dog_id", dog.id).maybeSingle())) as any;
  if (!own) throw bad("NOT_FOUND", "errors.linkNotFound");
  await q(adminClient().from("share_links").update({ revoked_at: now() }).eq("id", a.id).eq("dog_id", dog.id).is("revoked_at", null));
  return {};
}

/** Página pública: resolve o link (ativo) para a seleção. Sem sessão. */
export async function resolveShare(token: string) {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return null;
  const rows = (await q(adminClient().rpc("resolve_share", { p_token_hash: await sha256hex(token) }))) as any[];
  if (!rows.length) return null;
  const entries = rows.map((r) => ({ id: r.entry_id as string, caption: r.caption as string, occurredDate: r.occurred_date as string, key: r.media_storage_key as string }));
  return { title: rows[0].title as string, entries, avatar: await shareAvatar(entries[0].id) };
}

/** Foto de perfil do cachorro do álbum compartilhado (com o ajuste de zoom/posição), se houver. */
async function shareAvatar(entryId: string) {
  const admin = adminClient();
  const e = (await admin.from("diary_entries").select("dog_id").eq("id", entryId).maybeSingle()).data as any;
  if (!e) return null;
  const dog = (await admin.from("dogs").select("photo_asset_id, avatar_crop").eq("id", e.dog_id).maybeSingle()).data as any;
  if (!dog?.photo_asset_id) return null;
  const m = (await admin.from("media_assets").select("private_storage_key, thumb_storage_key").eq("id", dog.photo_asset_id).maybeSingle()).data as any;
  if (!m) return null;
  return { key: (m.private_storage_key as string), crop: (dog.avatar_crop ?? null) as { x: number; y: number; zoom: number } | null };
}

export const RPC: Record<string, (ctx: Ctx, args: unknown) => Promise<unknown>> = {
  snapshot: (c) => snapshot(c), createDiary, updateDog, updateTimezone, ensureProfile: (c, a) => ensureProfile(c, (a as any)?.timezone).then(() => ({})),
  entryByRequestKey, findEntryByHash, saveEntry, updateEntry, deleteEntry,
  createAlbum, renameAlbum, deleteAlbum, addEntriesToAlbum,
  submitMission, swapDaily,
  saveHealthProfile, addWeight, saveCare, deleteCare,
  getDocument, updateDocument, deleteDocument,
  createUpload, confirmUpload, exportMetadata: (c) => exportMetadata(c), deleteAccount: (c) => deleteAccount(c),
  createShare, listShares: (c) => listShares(c), revokeShare,
  studioState: (c) => studioState(c), studioJob, studioCheckPhoto,
  creditShop: (c) => creditShop(c), createPurchase, purchaseStatus, fakePayPurchase, appleStore: (c) => appleStore(c), appleConfirm,
  achadinhosInfo: () => achadinhosInfo(),
  setPreferences,
  switchDog, referralInfo: (c) => referralInfo(c), setMyName, saveLetter, updateLetter, deleteLetter, toggleBone, deleteDiary, leaveDiary, listNotifications: (c) => listNotifications(c), markNotificationsRead, checkPushSubscription, unreadCount: (c) => unreadCount(c), savePushSubscription, saveNativePush, removePushSubscription, setNotifyPrefs, testPush: (c) => testPush(c), createInvite, acceptInvite, updateMember, removeMember,
  studioCreateJob: (c, a) => studioCreateJob(c, a, (fn) => after(fn)),
  markDemoImported: async (c) => { await q(c.supa.from("profiles").update({ demo_imported_at: now() }).eq("user_id", c.user.id)); return {}; },
};
