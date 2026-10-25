/**
 * Estúdio no servidor (MUDANCAS-V2 §9.2 + adendo §10): jobs persistentes, créditos de teste e proteções de custo.
 * Estados: queued → processing → succeeded | failed | cancelled. Crédito: reserva antes, consumo só depois de salvar,
 * liberação em falha confirmada. A arte vai para “Datas especiais” com o selo de IA e nunca conclui missão.
 */
import { after } from "next/server";
import { currentDog, requireEditor } from "./family";
import "server-only";
import { fullDiaryParams, serverMaxEntries } from "@/config/business";
import { z } from "zod";
import sharp from "sharp";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  STUDIO_ALBUM_TITLE, STUDIO_COST_USD, STUDIO_DEFAULTS, STUDIO_PRESETS, buildStudioPrompt, estimateCostUsd, imageSizeFor, presetById, type StudioAspect, type StudioPreset,
} from "@/config/studio";
import { civilDateInTz } from "@/domain/dates";
import { adminClient, HttpError } from "./supabase";
import { notifyFamily } from "./notify";
import { ProviderError, artGenerator, type PhotoAssessment } from "./art-generator";
import { assessPhoto, type PhotoCheck } from "./photo-quality";
import { XP_MONTH_GOAL } from "@/config/credits";
import { localeOf, translator } from "./i18n";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctx = { user: User; supa: SupabaseClient };
const bad = (code: string, message: string, params?: Record<string, string | number>) => new HttpError(400, code, message, params);
const now = () => new Date().toISOString();
const env = (k: string, d: number) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && v > 0 ? v : d;
};
const paused = () => process.env.GENERATION_PAUSED === "true";

async function q(p: PromiseLike<{ data: any; error: any }>): Promise<any> {
  const { data, error } = await p;
  if (error) {
    console.error("studio supabase:", error.code, error.message);
    throw new HttpError(500, "SERVER", "errors.serverUnreachable");
  }
  return data;
}

const todayUtcStart = () => `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;

/** Presets com os ajustes sem deploy da tabela studio_presets (§10.7). */
async function presetsWithFlags(): Promise<(StudioPreset & { enabled: boolean })[]> {
  const rows = ((await adminClient().from("studio_presets").select("*")).data ?? []) as any[];
  const flags = new Map(rows.map((r) => [r.id, r]));
  const off = new Set((process.env.STUDIO_DISABLED_PRESETS ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  return STUDIO_PRESETS.map((p) => {
    const base = p.variantOf ?? p.id; // a variante ilustrada segue o ajuste do tema original
    const f = flags.get(base);
    return { ...p, enabled: (f ? f.enabled : p.enabled) && !off.has(p.id) && !off.has(base), credits: f?.credits ?? p.credits };
  });
}

const toJob = (r: any) => ({
  id: r.id, presetId: r.theme_id, presetVersion: r.preset_version, aspect: r.aspect, state: r.state, failureCode: r.failure_code,
  inputEntryId: r.input_entry_id, outputEntryId: r.output_entry_id, outputMediaId: r.output_asset_id, credits: r.credits, overlay: r.overlay,
  createdAt: r.created_at, finishedAt: r.finished_at, dogId: r.dog_id as string, compositeMediaId: (r.composite_asset_id as string | null) ?? null,
});

/**
 * A arte composta pelo app (nome/mensagem/moldura) passa a ser a imagem da lembrança: o Diário, o álbum, o link
 * público e o download mostram o mesmo que a tela de resultado. Idempotente: a primeira composição vale.
 */
export async function studioSetComposite(ctx: Ctx, args: unknown) {
  const a = z.object({ jobId: z.string().uuid(), mediaId: z.string().uuid() }).parse(args);
  const dog = (await currentDog(ctx))!;
  requireEditor(dog);
  const admin = adminClient();
  const job = (await q(admin.from("generation_jobs").select("*").eq("id", a.jobId).eq("dog_id", dog.id).maybeSingle())) as any;
  if (!job || job.state !== "succeeded" || !job.output_entry_id) throw bad("NOT_FOUND", "errors.jobNotFound");
  if (job.composite_asset_id) return toJob(job);
  const media = (await q(admin.from("media_assets").select("id, status, kind, dog_id").eq("id", a.mediaId).maybeSingle())) as any;
  if (!media || media.status !== "ready" || media.kind !== "art" || media.dog_id !== dog.id) throw bad("NOT_FOUND", "errors.mediaNotFound");
  await q(admin.from("diary_entries").update({ media_asset_id: a.mediaId }).eq("id", job.output_entry_id).eq("dog_id", dog.id).eq("media_asset_id", job.output_asset_id));
  const upd = (await q(admin.from("generation_jobs").update({ composite_asset_id: a.mediaId, updated_at: now() }).eq("id", a.jobId).is("composite_asset_id", null).select("*"))) as any[];
  return toJob(upd[0] ?? job);
}

/** Tela do Estúdio: disponibilidade, saldo de teste, limites, presets e histórico. */
export async function studioState(ctx: Ctx) {
  const admin = adminClient();
  const gen = artGenerator();
  const dog = (await currentDog(ctx))!;
  // Créditos são do diário: boas-vindas (uma vez por pessoa, só no diário que ela criou: convidados não somam) e arte do mês do cachorro.
  // Tudo o que é independente vai junto (cada ida ao banco custa tempo): primeiro concessões e limpeza, depois as leituras.
  await Promise.all([
    gen && dog.owner_id === ctx.user.id ? q(admin.rpc("grant_welcome_credits", { p_owner: ctx.user.id, p_dog: dog.id, p_amount: env("STUDIO_TEST_CREDITS", STUDIO_DEFAULTS.testCredits) })) : null,
    reconcileStuck(dog.id),
    q(admin.rpc("grant_monthly_xp_credit_dog", { p_dog: dog.id, p_goal: XP_MONTH_GOAL })),
  ]);
  const [balance, jobs, usedToday, consumed, presets] = await Promise.all([
    q(admin.rpc("credit_available_dog", { p_dog: dog.id })),
    q(ctx.supa.from("generation_jobs").select("*").eq("dog_id", dog.id).order("created_at", { ascending: false }).limit(30)),
    countToday(dog.id),
    admin.from("credit_ledger").select("amount").eq("dog_id", dog.id).eq("operation", "consume"),
    presetsWithFlags(),
  ]);
  return {
    available: !!gen && !paused(),
    configured: !!gen,
    paused: paused(),
    balance: balance as number,
    testCredits: true,
    creditsGranted: env("STUDIO_TEST_CREDITS", STUDIO_DEFAULTS.testCredits),
    creditsUsed: ((consumed.data ?? []) as { amount: number }[]).reduce((t, r) => t + r.amount, 0),
    dailyUsed: usedToday,
    dailyLimit: env("STUDIO_DAILY_PER_ACCOUNT", STUDIO_DEFAULTS.dailyPerAccount),
    presets: presets.map((p) => ({ id: p.id, enabled: p.enabled, credits: p.credits })),
    jobs: (jobs as any[]).map(toJob),
  };
}

/** Vagas no diário contando as artes em andamento (cada uma vai virar uma lembrança). Erro de contagem é erro, nunca "zero". */
async function capacityLeft(dogId: string) {
  const admin = adminClient();
  const [entries, active] = await Promise.all([
    admin.from("diary_entries").select("id", { count: "exact", head: true }).eq("dog_id", dogId).is("deleted_at", null),
    admin.from("generation_jobs").select("id", { count: "exact", head: true }).eq("dog_id", dogId).in("state", ["queued", "processing"]),
  ]);
  if (entries.error || active.error || entries.count === null || active.count === null) throw new HttpError(503, "SERVER", "errors.spaceCheckFailed");
  return serverMaxEntries() - entries.count - active.count;
}

/**
 * Álbum "Artes do Estúdio" do cachorro: um só (system_key = studio), mesmo com artes simultâneas.
 * O título gravado é o original em português; a tela mostra o nome no idioma de quem vê (STUDIO_ALBUM_TITLE).
 */
async function studioAlbumId(dogId: string, ownerId: string): Promise<string> {
  const admin = adminClient();
  const find = async () => ((await admin.from("albums").select("id").eq("dog_id", dogId).eq("system_key", "studio").maybeSingle()).data as any)?.id as string | undefined;
  const found = await find();
  if (found) return found;
  const { data, error } = await admin.from("albums").insert({ owner_id: ownerId, dog_id: dogId, title: STUDIO_ALBUM_TITLE, type: "custom", system_key: "studio" }).select("id").single();
  if (!error) return (data as any).id;
  const again = await find(); // outra arte criou ao mesmo tempo
  if (again) return again;
  throw new ProviderError("PROVIDER_UNAVAILABLE", "álbum de artes");
}


async function countToday(dogId?: string) {
  let query = adminClient().from("generation_jobs").select("id", { count: "exact", head: true }).gte("created_at", todayUtcStart()).or("failure_code.is.null,failure_code.neq.NO_CREDITS");
  if (dogId) query = query.eq("dog_id", dogId);
  const { count, error } = await query;
  if (error) throw new HttpError(500, "SERVER", "errors.generic"); // erro de contagem não vira "zero" (gasto incerto)
  return count ?? 0;
}

const CreateJob = z.object({
  entryId: z.string().uuid(),
  presetId: z.string(),
  aspect: z.enum(["1:1", "4:5", "9:16"]).optional(),
  idempotencyKey: z.string().uuid(),
  crop: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0.1).max(1), h: z.number().min(0.1).max(1) }).nullable().optional(),
  overlay: z.object({ name: z.string().max(40).optional(), message: z.string().max(80).optional(), frame: z.enum(["simples", "patinhas", "festa"]).optional() }).nullable().optional(),
});

/** Cria o job (idempotente), reserva os créditos e agenda a geração. */
type Crop = { x: number; y: number; w: number; h: number } | null | undefined;

/** Lê a foto do diário (bytes do bucket privado) e aplica o recorte escolhido. */
async function loadInputPhoto(mediaAssetId: string, crop: Crop) {
  const admin = adminClient();
  const media = (await q(admin.from("media_assets").select("private_storage_key").eq("id", mediaAssetId).single())) as any;
  const { data: file } = await admin.storage.from("media").download(media.private_storage_key);
  if (!file) throw new ProviderError("PROVIDER_UNAVAILABLE", "foto de entrada indisponível");
  let input = Buffer.from(await file.arrayBuffer());
  if (crop) {
    input = await sharp(input).rotate().toBuffer();
    const m = await sharp(input).metadata();
    const W = m.width ?? 1, H = m.height ?? 1;
    input = await sharp(input).extract({ left: Math.round(crop.x * W), top: Math.round(crop.y * H), width: Math.max(16, Math.min(W - Math.round(crop.x * W), Math.round(crop.w * W))), height: Math.max(16, Math.min(H - Math.round(crop.y * H), Math.round(crop.h * H))) }).toBuffer();
  }
  return input;
}

/** Análises pagas de foto por pessoa por dia (o resultado da mesma foto + recorte é reaproveitado sem custo). */
const PHOTO_CHECKS_PER_DAY = 40;
const cropKey = (crop: Crop) => (crop ? [crop.x, crop.y, crop.w, crop.h].map((v) => v.toFixed(2)).join(",") : "full");

/** Parte paga da análise com cache (foto + recorte), limite por pessoa e custo somado ao teto do dia. */
function photoCheckCache(assetId: string, crop: Crop, userId: string) {
  return async (run: () => Promise<PhotoAssessment | null>): Promise<PhotoAssessment | null> => {
    const admin = adminClient();
    const key = cropKey(crop);
    const hit = (await admin.from("photo_checks").select("result").eq("asset_id", assetId).eq("crop_key", key).maybeSingle()).data as any;
    if (hit) return hit.result as PhotoAssessment;
    // Reserva atômica ANTES de chamar a IA (limite por pessoa + teto do dia): chamadas ao mesmo tempo não passam do
    // limite, e uma tentativa sem resultado continua contada (pode ter sido cobrada). Sem vaga: só as checagens grátis.
    const budget = Number(process.env.STUDIO_DAILY_BUDGET_USD) || null;
    const { data: ok, error } = await admin.rpc("reserve_photo_check", { p_user: userId, p_cost: STUDIO_COST_USD.check, p_per_day: PHOTO_CHECKS_PER_DAY, p_budget_usd: budget });
    if (error || !ok) return null;
    const r = await run();
    // Custo já está na reserva; o resultado entra no cache (foto + recorte) sem somar de novo.
    if (r) await admin.from("photo_checks").upsert({ asset_id: assetId, crop_key: key, result: r, cost_usd: 0, requested_by: userId }, { onConflict: "asset_id,crop_key", ignoreDuplicates: true });
    return r;
  };
}

const CheckPhoto = z.object({
  entryId: z.string().uuid(),
  crop: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0.1).max(1), h: z.number().min(0.1).max(1) }).nullable().optional(),
});

/** Valida a foto escolhida antes de gastar crédito (chamado ao escolher a foto e ao mudar o recorte). */
export async function studioCheckPhoto(ctx: Ctx, args: unknown): Promise<PhotoCheck> {
  const a = CheckPhoto.safeParse(args);
  if (!a.success) throw bad("INVALID", "errors.invalidRequest");
  const dog = (await currentDog(ctx))!;
  const entry = (await q(ctx.supa.from("diary_entries").select("id, source, media_asset_id").eq("id", a.data.entryId).eq("dog_id", dog.id).is("deleted_at", null).maybeSingle())) as any;
  if (!entry) throw bad("NOT_FOUND", "errors.photoNotFound");
  if (entry.source === "studio") throw bad("INVALID", "errors.pickPhotoNotArt");
  if ((await capacityLeft(dog.id)) <= 0) throw bad("NO_SPACE", "errors.fullDiaryNoCredit", fullDiaryParams(dog.name));
  try {
    const crop = a.data.crop ?? null;
    const r = await assessPhoto(await loadInputPhoto(entry.media_asset_id, crop), artGenerator(), photoCheckCache(entry.media_asset_id, crop, ctx.user.id));
    return r; // códigos; a tela mostra o texto no idioma da pessoa (studio.issues.<código>)
  } catch {
    return { verdict: "warn", issues: [], aiChecked: false }; // falha nossa: não bloqueia, mas não garante nada
  }
}

export async function studioCreateJob(ctx: Ctx, args: unknown, schedule: (fn: () => Promise<void>) => void) {
  const a = CreateJob.safeParse(args);
  if (!a.success) throw bad("INVALID", "errors.invalidRequest");
  const { entryId, presetId, idempotencyKey, crop, overlay } = a.data;
  const admin = adminClient();
  const dog = (await currentDog(ctx))!;
  requireEditor(dog);
  const prior = (await q(admin.from("generation_jobs").select("*").eq("dog_id", dog.id).eq("idempotency_key", idempotencyKey).maybeSingle())) as any;
  if (prior) return toJob(prior); // duplo clique / retry: mesmo job, mesma cobrança
  if (paused()) throw bad("PAUSED", "errors.studioPaused");
  const gen = artGenerator();
  if (!gen) throw bad("NOT_CONFIGURED", "errors.studioNotConfigured");
  const preset = (await presetsWithFlags()).find((p) => p.id === presetId);
  if (!preset || !preset.enabled) throw bad("PRESET_OFF", "errors.presetOff");
  const aspect: StudioAspect = a.data.aspect && preset.aspects.includes(a.data.aspect) ? a.data.aspect : preset.aspect;
  const entry = (await q(ctx.supa.from("diary_entries").select("id, dog_id, source, media_asset_id").eq("id", entryId).eq("dog_id", dog.id).is("deleted_at", null).maybeSingle())) as any;
  if (!entry) throw bad("NOT_FOUND", "errors.photoNotFound");
  if (entry.source === "studio") throw bad("INVALID", "errors.pickPhotoNotArt");
  // Limites do dia (por cachorro e geral), vaga no diário e orçamento: tudo conferido NO BANCO, com trava, junto com
  // a criação do job, ANTES de qualquer chamada paga. Dois pedidos ao mesmo tempo não passam juntos.
  const budget = Number(process.env.STUDIO_DAILY_BUDGET_USD) || null;
  const created = await admin.rpc("create_studio_job", {
    p_job: {
      owner_id: dog.owner_id, dog_id: dog.id, requested_by: ctx.user.id, input_entry_id: entry.id, input_asset_id: entry.media_asset_id, theme_id: preset.id, preset_version: preset.version,
      aspect, crop: crop ?? null, overlay: overlay ?? null, model: gen.modelFor(preset.premium), credits: preset.credits, cost_usd: estimateCostUsd(preset, aspect), idempotency_key: idempotencyKey,
    },
    p_max_entries: serverMaxEntries(), p_budget_usd: budget,
    p_max_per_dog: env("STUDIO_DAILY_PER_ACCOUNT", STUDIO_DEFAULTS.dailyPerAccount),
    p_max_global: env("STUDIO_MAX_DAILY_GENERATIONS", STUDIO_DEFAULTS.maxDailyGenerations),
  });
  if (created.error) {
    if (/NO_SPACE/.test(created.error.message)) throw bad("NO_SPACE", "errors.fullDiaryNoCredit", fullDiaryParams(dog.name));
    if (/BUDGET/.test(created.error.message)) throw bad("GLOBAL_LIMIT", "errors.globalPause");
    if (/DAILY_LIMIT/.test(created.error.message)) throw bad("DAILY_LIMIT", "errors.dailyLimit");
    if (/GLOBAL_LIMIT/.test(created.error.message)) throw bad("GLOBAL_LIMIT", "errors.globalLimit");
    console.error("create_studio_job:", created.error.message);
    throw new HttpError(500, "SERVER", "errors.startArtFailed");
  }
  const job = (await q(admin.from("generation_jobs").select("*").eq("id", created.data).single())) as any;
  if (job.state !== "queued") return toJob(job); // toque duplo: o mesmo pedido
  // Análise da foto (paga, barata): só depois da vaga reservada. Foto inadequada libera a vaga sem cobrar crédito.
  const photoCheck = await assessPhoto(await loadInputPhoto(entry.media_asset_id, crop ?? null), gen, photoCheckCache(entry.media_asset_id, crop ?? null, ctx.user.id)).catch(() => null);
  if (photoCheck?.verdict === "bad") {
    await q(admin.from("generation_jobs").update({ state: "cancelled", failure_code: "PHOTO_UNSUITABLE", finished_at: now(), updated_at: now() }).eq("id", job.id));
    throw bad("PHOTO_UNSUITABLE", `studio.issues.${photoCheck.issues.find((i) => i.level === "bad")!.code}`, { dog: dog.name });
  }
  const reserved = await q(admin.rpc("reserve_credit_dog", { p_dog: dog.id, p_owner: dog.owner_id, p_job: job.id, p_cost: preset.credits }));
  if (!reserved) {
    await q(admin.from("generation_jobs").update({ state: "failed", failure_code: "NO_CREDITS", finished_at: now() }).eq("id", job.id));
    throw bad("NO_CREDITS", "errors.noCredits");
  }
  schedule(() => processJob(job.id));
  return toJob(job);
}

export async function studioJob(ctx: Ctx, args: unknown) {
  const id = z.object({ id: z.string().uuid() }).parse(args).id;
  // Pelo pedido, não pelo diário aberto: trocar de cachorro durante a geração não perde o acompanhamento.
  // A regra do banco (jobs_read) só mostra pedidos de diários de que a pessoa participa.
  const found = (await q(ctx.supa.from("generation_jobs").select("dog_id").eq("id", id).maybeSingle())) as any;
  if (!found) throw bad("NOT_FOUND", "errors.jobNotFound");
  await reconcileStuck(found.dog_id);
  return toJob(await q(ctx.supa.from("generation_jobs").select("*").eq("id", id).single()));
}

/**
 * Termina um job com falha confirmada e devolve a reserva — só se ele ainda estava em andamento. Um job já concluído
 * (arte entregue, crédito consumido) nunca vira falha aqui, nem pelo "travado" nem por uma repetição.
 */
async function fail(jobId: string, code: string) {
  const admin = adminClient();
  const changed = (await q(admin.from("generation_jobs").update({ state: "failed", failure_code: code, finished_at: now(), updated_at: now() }).eq("id", jobId).in("state", ["queued", "processing"]).select("id"))) as any[];
  if (changed.length) await q(admin.rpc("settle_credit", { p_job: jobId, p_op: "release" }));
}

/** O crédito deste job está reservado? (sem reserva, nunca chama a IA paga) */
async function hasReserve(jobId: string) {
  return !!(await q(adminClient().from("credit_ledger").select("id").eq("idempotency_key", `reserve:${jobId}`).maybeSingle()));
}

/**
 * Jobs travados:
 * - na fila há tempo demais (o processamento não chegou a começar): com crédito reservado, é processado de novo;
 *   sem reserva, falha sem cobrar;
 * - processando além do prazo: se a arte já está no Diário (lembrança com este job), conclui (consumo uma vez);
 *   senão, com `store: false` não há resultado a recuperar: falha confirmada e a reserva volta.
 */
async function reconcileStuck(dogId: string) {
  const admin = adminClient();
  const limit = new Date(Date.now() - env("STUDIO_JOB_TIMEOUT_MINUTES", STUDIO_DEFAULTS.jobTimeoutMinutes) * 60_000).toISOString();
  const stuck = ((await q(admin.from("generation_jobs").select("id, state, created_at, output_entry_id").eq("dog_id", dogId).in("state", ["queued", "processing"]).lt("updated_at", limit))) ?? []) as any[];
  for (const j of stuck) {
    if (j.state === "queued") {
      if (await hasReserve(j.id)) after(() => processJob(j.id));
      else await fail(j.id, "NO_CREDITS");
      continue;
    }
    const delivered = (await q(admin.from("diary_entries").select("id, media_asset_id").eq("request_key", j.id).eq("source", "studio").maybeSingle())) as any;
    if (delivered) {
      await q(admin.rpc("settle_credit", { p_job: j.id, p_op: "consume" }));
      await q(admin.from("generation_jobs").update({ state: "succeeded", output_entry_id: delivered.id, output_asset_id: delivered.media_asset_id, finished_at: now(), updated_at: now() }).eq("id", j.id).eq("state", "processing"));
    } else await fail(j.id, "PROVIDER_TIMEOUT");
  }
}

/** Remove o fundo verde (#00FF00) da figurinha e exporta WebP 512×512 com transparência (adendo §10.6). */
export async function stickerFromGreen(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const greenness = g - Math.max(r, b);
    if (greenness > 90) data[i + 3] = 0;
    else if (greenness > 40) {
      data[i + 3] = Math.round(255 * (1 - (greenness - 40) / 50)); // borda suave
      data[i + 1] = Math.min(g, Math.max(r, b) + 20); // tira o halo verde
    }
  }
  const cut = await sharp(data, { raw: info }).png().toBuffer();
  const trimmed = await sharp(cut).trim({ threshold: 1 }).toBuffer().catch(() => cut);
  // Margem transparente em volta (figurinha recortada, nunca colada nas bordas).
  const fitted = await sharp(trimmed).resize(480, 480, { fit: "inside" }).png().toBuffer();
  const square = sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fitted, gravity: "center" }]);
  for (const quality of [90, 80, 70, 60]) {
    const out = await square.clone().webp({ quality, alphaQuality: 100 }).toBuffer();
    if (out.length <= 100 * 1024) return out; // figurinha do WhatsApp: até 100 KB
  }
  return square.clone().webp({ quality: 50, alphaQuality: 100 }).toBuffer();
}

/** Processa um job: só um processador ganha a “reivindicação” (queued → processing). */
export async function processJob(jobId: string) {
  const admin = adminClient();
  const claimed = ((await admin.from("generation_jobs").update({ state: "processing", started_at: now(), updated_at: now() }).eq("id", jobId).eq("state", "queued").select("*")).data ?? []) as any[];
  const job = claimed[0];
  if (!job) return;
  // Sem crédito reservado (falha entre criar o job e reservar), nunca chama a IA paga.
  if (!(await hasReserve(jobId).catch(() => false))) { await fail(jobId, "NO_CREDITS").catch(() => undefined); return; }
  const preset = presetById(job.theme_id);
  const gen = artGenerator();
  let providerCalled = false;
  let uploaded: string[] = []; // arquivos já enviados desta tentativa (limpeza se ela não for concluída)
  let finished = false;
  try {
    if (!preset || !gen) throw new ProviderError("NOT_CONFIGURED", "sem provedor");
    const entry = (await q(admin.from("diary_entries").select("id, media_asset_id, deleted_at").eq("id", job.input_entry_id).maybeSingle())) as any;
    if (!entry || entry.deleted_at) {
      // Foto excluída durante o job: cancela e devolve (briefing §19).
      await q(admin.from("generation_jobs").update({ state: "cancelled", failure_code: "INPUT_DELETED", finished_at: now() }).eq("id", jobId));
      await q(admin.rpc("settle_credit", { p_job: jobId, p_op: "release" }));
      return;
    }
    let input = await loadInputPhoto(entry.media_asset_id, job.crop);
    input = await sharp(input).rotate().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    const aspect = job.aspect as StudioAspect;
    providerCalled = true;
    const out = await gen.generate({ image: input, mime: "image/jpeg", prompt: buildStudioPrompt(preset, aspect), aspect, imageSize: imageSizeFor(aspect), premium: preset.premium });
    const check = await gen.check(out.image, out.mime).catch(() => ({ dog: true, text: false }));
    if (!check.dog || check.text) throw new ProviderError("QUALITY_REJECTED", "arte fora das regras");

    // Acabamento por formato.
    let art: Buffer;
    if (preset.post === "sticker") art = await stickerFromGreen(out.image);
    else if (preset.post === "wallpaper") art = await sharp(out.image).resize(1080, 1920, { fit: "cover" }).webp({ quality: 90 }).toBuffer();
    else art = await sharp(out.image).webp({ quality: 90 }).toBuffer();
    const meta = await sharp(art).metadata();
    const thumb = await sharp(art).resize(400, 400, { fit: "inside" }).webp({ quality: 80 }).toBuffer();
    const hash = Buffer.from(await crypto.subtle.digest("SHA-256", new Uint8Array(art))).toString("hex");

    // Salva como mídia de arte + lembrança “Arte criada com IA” no álbum Datas especiais.
    const mediaId = crypto.randomUUID();
    const key = `${job.owner_id}/${mediaId}.webp`, thumbKey = `${job.owner_id}/${mediaId}-thumb.webp`;
    for (const [k, b] of [[key, art], [thumbKey, thumb]] as const) {
      const { error } = await admin.storage.from("media").upload(k, b, { contentType: "image/webp", upsert: false });
      if (error) throw new ProviderError("PROVIDER_UNAVAILABLE", "não salvou a arte");
      uploaded = [...uploaded, k];
    }
    const profile = (await q(admin.from("profiles").select("timezone").eq("user_id", job.owner_id).maybeSingle())) as any;
    const tz = profile?.timezone ?? "America/Sao_Paulo";
    const albumId = await studioAlbumId(job.dog_id, job.owner_id);
    // Conclusão numa transação só (finalize_studio_job): mídia + lembrança (de quem pediu, com aviso à família) +
    // álbum + consumo do crédito + "concluída". Ou tudo, ou nada; repetir devolve a mesma lembrança.
    const fin = await admin.rpc("finalize_studio_job", {
      p_job: jobId,
      p_media: { id: mediaId, private_storage_key: key, thumb_storage_key: thumbKey, bytes: art.length, width: meta.width ?? 1024, height: meta.height ?? 1024, hash },
      p_entry: { caption: await artCaption(job.requested_by ?? job.owner_id, preset.variantOf ?? preset.id), occurred_date: civilDateInTz(new Date(), tz), timezone: tz },
      p_album: albumId,
      p_provider: out.model,
    });
    if (fin.error) {
      if (/STORAGE_QUOTA/.test(fin.error.message)) throw new ProviderError("NO_SPACE", "diário cheio");
      throw new ProviderError("PROVIDER_UNAVAILABLE", "não salvou a arte");
    }
    finished = true;
    const outEntry = { id: fin.data as string };
    // Registro de custo é controle interno: se falhar, a arte entregue continua entregue (só fica no log).
    const usage = await admin.from("usage_events").insert({ owner_id: job.owner_id, type: `generation:${preset.id}`, day_bucket: new Date().toISOString().slice(0, 10), cost_units: job.cost_usd, request_id: jobId });
    if (usage.error) console.error("studio: registro de uso não gravado", jobId, usage.error.message);
    // Aviso para a família só depois de a arte estar salva no diário.
    if (job.requested_by) {
      const dog = (await admin.from("dogs").select("name").eq("id", job.dog_id).maybeSingle()).data as any;
      await notifyFamily({ user: { id: job.requested_by } as User }, { dogId: job.dog_id, dogName: dog?.name ?? "", kind: "art", targetType: "entry", targetId: outEntry.id, detail: preset.variantOf ?? preset.id, now: true });
    }
  } catch (e) {
    // Depois de concluída (arte entregue e crédito consumido), nada mais transforma a arte em falha.
    if (finished) { console.error("studio: depois da conclusão", jobId, e); return; }
    const code = e instanceof ProviderError ? e.code : "TECHNICAL";
    if (!(e instanceof ProviderError)) console.error("studio job", jobId, e);
    // Arquivos já enviados desta tentativa, sem lembrança: vão para a fila de limpeza (não ficam órfãos).
    if (uploaded.length) await admin.from("storage_cleanup").insert(uploaded.map((k) => ({ bucket: "media", object_key: k, reason: "studio_failed" }))).then(() => undefined, () => undefined);
    // Tentativa que pode ter sido cobrada pelo provedor: entra no controle de custo (valor ESTIMADO).
    if (providerCalled) await admin.from("usage_events").insert({ owner_id: job.owner_id, type: `generation-failed:${job.theme_id}`, day_bucket: new Date().toISOString().slice(0, 10), cost_units: job.cost_usd, request_id: `${jobId}:failed` }).then(() => undefined, () => undefined);
    await fail(jobId, code).catch((err) => console.error("studio fail", jobId, err));
  }
}

/** Legenda da arte no idioma de quem pediu (vira uma legenda comum: a pessoa pode editar). */
async function artCaption(userId: string, presetId: string) {
  const t = translator(await localeOf(userId));
  const key = `studioCatalog.presets.${presetId}.label`;
  return t("studio.artCaption", { theme: t.has(key as never) ? t(key as never) : presetId }).slice(0, 280);
}

