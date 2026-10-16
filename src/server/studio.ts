/**
 * Estúdio no servidor (MUDANCAS-V2 §9.2 + adendo §10): jobs persistentes, créditos de teste e proteções de custo.
 * Estados: queued → processing → succeeded | failed | cancelled. Crédito: reserva antes, consumo só depois de salvar,
 * liberação em falha confirmada. A arte vai para “Datas especiais” com o selo de IA e nunca conclui missão.
 */
import { currentDog, requireEditor } from "./family";
import "server-only";
import { fullDiaryText, serverMaxEntries } from "@/config/business";
import { z } from "zod";
import sharp from "sharp";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  STUDIO_DEFAULTS, STUDIO_PRESETS, buildStudioPrompt, estimateCostUsd, imageSizeFor, presetById, type StudioAspect, type StudioPreset,
} from "@/config/studio";
import { civilDateInTz } from "@/domain/dates";
import { adminClient, HttpError } from "./supabase";
import { ProviderError, artGenerator } from "./art-generator";
import { assessPhoto, type PhotoCheck } from "./photo-quality";
import { XP_MONTH_GOAL } from "@/config/credits";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctx = { user: User; supa: SupabaseClient };
const bad = (code: string, message: string) => new HttpError(400, code, message);
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
    throw new HttpError(500, "SERVER", "Não conseguimos falar com o servidor. Tente de novo.");
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
    const f = flags.get(p.id);
    return { ...p, enabled: (f ? f.enabled : p.enabled) && !off.has(p.id), credits: f?.credits ?? p.credits };
  });
}

const toJob = (r: any) => ({
  id: r.id, presetId: r.theme_id, presetVersion: r.preset_version, aspect: r.aspect, state: r.state, failureCode: r.failure_code,
  inputEntryId: r.input_entry_id, outputEntryId: r.output_entry_id, outputMediaId: r.output_asset_id, credits: r.credits, overlay: r.overlay,
  createdAt: r.created_at, finishedAt: r.finished_at,
});

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

async function countToday(dogId?: string) {
  let query = adminClient().from("generation_jobs").select("id", { count: "exact", head: true }).gte("created_at", todayUtcStart()).or("failure_code.is.null,failure_code.neq.NO_CREDITS");
  if (dogId) query = query.eq("dog_id", dogId);
  const { count } = await query;
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

const CheckPhoto = z.object({
  entryId: z.string().uuid(),
  crop: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0.1).max(1), h: z.number().min(0.1).max(1) }).nullable().optional(),
});

/** Valida a foto escolhida antes de gastar crédito (chamado ao escolher a foto e ao mudar o recorte). */
export async function studioCheckPhoto(ctx: Ctx, args: unknown): Promise<PhotoCheck> {
  const a = CheckPhoto.safeParse(args);
  if (!a.success) throw bad("INVALID", "Pedido inválido.");
  const dog = (await currentDog(ctx))!;
  const entry = (await q(ctx.supa.from("diary_entries").select("id, source, media_asset_id").eq("id", a.data.entryId).eq("dog_id", dog.id).is("deleted_at", null).maybeSingle())) as any;
  if (!entry) throw bad("NOT_FOUND", "Foto não encontrada.");
  if (entry.source === "studio") throw bad("INVALID", "Escolha uma foto, não uma arte.");
  try {
    const r = await assessPhoto(await loadInputPhoto(entry.media_asset_id, a.data.crop), artGenerator());
    return { ...r, issues: r.issues.map((i) => ({ ...i, message: i.message.replaceAll("{dog}", dog.name) })) };
  } catch {
    return { verdict: "warn", issues: [], aiChecked: false }; // falha nossa: não bloqueia, mas não garante nada
  }
}

export async function studioCreateJob(ctx: Ctx, args: unknown, schedule: (fn: () => Promise<void>) => void) {
  const a = CreateJob.safeParse(args);
  if (!a.success) throw bad("INVALID", "Pedido inválido.");
  const { entryId, presetId, idempotencyKey, crop, overlay } = a.data;
  const admin = adminClient();
  const dog = (await currentDog(ctx))!;
  requireEditor(dog);
  const prior = (await q(admin.from("generation_jobs").select("*").eq("dog_id", dog.id).eq("idempotency_key", idempotencyKey).maybeSingle())) as any;
  if (prior) return toJob(prior); // duplo clique / retry: mesmo job, mesma cobrança
  if (paused()) throw bad("PAUSED", "A criação de artes está pausada no momento. O resto do diário segue normal.");
  const gen = artGenerator();
  if (!gen) throw bad("NOT_CONFIGURED", "O Estúdio ainda não está disponível.");
  const preset = (await presetsWithFlags()).find((p) => p.id === presetId);
  if (!preset || !preset.enabled) throw bad("PRESET_OFF", "Esse tema não está disponível agora.");
  const aspect: StudioAspect = a.data.aspect && preset.aspects.includes(a.data.aspect) ? a.data.aspect : preset.aspect;
  const entry = (await q(ctx.supa.from("diary_entries").select("id, dog_id, source, media_asset_id").eq("id", entryId).eq("dog_id", dog.id).is("deleted_at", null).maybeSingle())) as any;
  if (!entry) throw bad("NOT_FOUND", "Foto não encontrada.");
  if (entry.source === "studio") throw bad("INVALID", "Escolha uma foto, não uma arte.");
  if ((await countToday(dog.id)) >= env("STUDIO_DAILY_PER_ACCOUNT", STUDIO_DEFAULTS.dailyPerAccount)) throw bad("DAILY_LIMIT", "Você chegou ao limite de artes de hoje. Amanhã tem mais.");
  if ((await countToday()) >= env("STUDIO_MAX_DAILY_GENERATIONS", STUDIO_DEFAULTS.maxDailyGenerations)) throw bad("GLOBAL_LIMIT", "O Estúdio atingiu o limite de artes de hoje. Tente amanhã.");
  // Foto inadequada não vira cobrança: bloqueia antes de reservar o crédito (avisos leves deixam seguir).
  const photoCheck = await assessPhoto(await loadInputPhoto(entry.media_asset_id, crop), gen).catch(() => null);
  if (photoCheck?.verdict === "bad") throw bad("PHOTO_UNSUITABLE", photoCheck.issues.find((i) => i.level === "bad")!.message);
  // Sem espaço no diário a arte não teria onde ficar: recusa ANTES de reservar o crédito.
  const { count: used } = await admin.from("diary_entries").select("id", { count: "exact", head: true }).eq("dog_id", dog.id).is("deleted_at", null);
  if ((used ?? 0) >= serverMaxEntries()) throw bad("NO_SPACE", `${fullDiaryText(dog.name)} Nenhum crédito foi usado.`);
  const job = (await q(admin.from("generation_jobs").insert({
    owner_id: dog.owner_id, dog_id: dog.id, input_entry_id: entry.id, input_asset_id: entry.media_asset_id, theme_id: preset.id, preset_version: preset.version,
    aspect, crop: crop ?? null, overlay: overlay ?? null, model: gen.modelFor(preset.premium), credits: preset.credits, cost_usd: estimateCostUsd(preset, aspect), idempotency_key: idempotencyKey,
  }).select("*").single())) as any;
  const reserved = await q(admin.rpc("reserve_credit_dog", { p_dog: dog.id, p_owner: dog.owner_id, p_job: job.id, p_cost: preset.credits }));
  if (!reserved) {
    await q(admin.from("generation_jobs").update({ state: "failed", failure_code: "NO_CREDITS", finished_at: now() }).eq("id", job.id));
    throw bad("NO_CREDITS", "Os créditos deste diário acabaram.");
  }
  schedule(() => processJob(job.id));
  return toJob(job);
}

export async function studioJob(ctx: Ctx, args: unknown) {
  const id = z.object({ id: z.string().uuid() }).parse(args).id;
  const dog = (await currentDog(ctx))!;
  await reconcileStuck(dog.id);
  const job = (await q(ctx.supa.from("generation_jobs").select("*").eq("id", id).eq("dog_id", dog.id).maybeSingle())) as any;
  if (!job) throw bad("NOT_FOUND", "Pedido não encontrado.");
  return toJob(job);
}

/** Termina um job com falha confirmada e devolve o crédito. */
async function fail(jobId: string, code: string) {
  const admin = adminClient();
  await q(admin.from("generation_jobs").update({ state: "failed", failure_code: code, finished_at: now(), updated_at: now() }).eq("id", jobId).in("state", ["queued", "processing"]));
  await q(admin.rpc("settle_credit", { p_job: jobId, p_op: "release" }));
}

/**
 * Jobs travados: com `store: false` o provedor não guarda o pedido, então não há resultado a recuperar —
 * se passou do tempo, nada foi entregue: falha confirmada e o crédito volta. Fila esquecida é retomada.
 */
async function reconcileStuck(dogId: string) {
  const admin = adminClient();
  const limit = new Date(Date.now() - env("STUDIO_JOB_TIMEOUT_MINUTES", STUDIO_DEFAULTS.jobTimeoutMinutes) * 60_000).toISOString();
  const stuck = ((await admin.from("generation_jobs").select("id, state, created_at").eq("dog_id", dogId).in("state", ["queued", "processing"]).lt("updated_at", limit)).data ?? []) as any[];
  for (const j of stuck) await fail(j.id, "PROVIDER_TIMEOUT");
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
  const preset = presetById(job.theme_id);
  const gen = artGenerator();
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
    }
    await q(admin.from("media_assets").insert({ id: mediaId, owner_id: job.owner_id, dog_id: job.dog_id, private_storage_key: key, thumb_storage_key: thumbKey, mime: "image/webp", bytes: art.length, width: meta.width ?? 1024, height: meta.height ?? 1024, hash, kind: "art", status: "ready" }));
    const profile = (await q(admin.from("profiles").select("timezone").eq("user_id", job.owner_id).maybeSingle())) as any;
    const tz = profile?.timezone ?? "America/Sao_Paulo";
    const outEntry = (await q(admin.from("diary_entries").upsert({
      owner_id: job.owner_id, dog_id: job.dog_id, media_asset_id: mediaId, caption: `Arte: ${preset.labelPt}`.slice(0, 280),
      occurred_date: civilDateInTz(new Date(), tz), timezone: tz, source: "studio", request_key: job.id,
    }, { onConflict: "owner_id,request_key" }).select("id").single())) as any;
    let album = (await q(admin.from("albums").select("id").eq("dog_id", job.dog_id).eq("collection_id", "datas-especiais").maybeSingle())) as any;
    album ??= await q(admin.from("albums").insert({ owner_id: job.owner_id, dog_id: job.dog_id, collection_id: "datas-especiais", title: "Datas especiais", type: "collection" }).select("id").single());
    await q(admin.from("album_entries").upsert({ album_id: album.id, entry_id: outEntry.id }, { onConflict: "album_id,entry_id", ignoreDuplicates: true }));

    // Só agora: consome o crédito, registra o custo e conclui.
    await q(admin.rpc("settle_credit", { p_job: jobId, p_op: "consume" }));
    await q(admin.from("usage_events").insert({ owner_id: job.owner_id, type: `generation:${preset.id}`, day_bucket: new Date().toISOString().slice(0, 10), cost_units: job.cost_usd, request_id: jobId }));
    await q(admin.from("generation_jobs").update({ state: "succeeded", output_asset_id: mediaId, output_entry_id: outEntry.id, provider_job_id: out.model, finished_at: now(), updated_at: now() }).eq("id", jobId));
  } catch (e) {
    const code = e instanceof ProviderError ? e.code : "TECHNICAL";
    if (!(e instanceof ProviderError)) console.error("studio job", jobId, e);
    await fail(jobId, code).catch((err) => console.error("studio fail", jobId, err));
  }
}

export const STUDIO_FAILURE_MESSAGES: Record<string, string> = {
  PROVIDER_REFUSED: "Não consegui usar esta foto. Tente outra em que {dog} apareça sozinho. O crédito foi devolvido.",
  QUALITY_REJECTED: "A arte não ficou boa o bastante ({dog} não apareceu direito). O crédito foi devolvido.",
  PROVIDER_TIMEOUT: "A arte demorou demais e foi cancelada. O crédito foi devolvido.",
  PROVIDER_UNAVAILABLE: "O serviço de artes está instável agora. O crédito foi devolvido — tente de novo mais tarde.",
  NO_CREDITS: "Os créditos acabaram por enquanto. Dá para criar mais em Créditos, ou ganhar 1 crédito juntando patinhas no mês.",
  INPUT_DELETED: "A foto foi excluída antes de a arte ficar pronta. O crédito foi devolvido.",
  NOT_CONFIGURED: "O Estúdio ainda não está disponível. O crédito foi devolvido.",
  TECHNICAL: "Algo deu errado do nosso lado. O crédito foi devolvido.",
};
