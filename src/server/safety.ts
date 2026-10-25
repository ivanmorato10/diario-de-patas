/**
 * Proteção contra abuso (App Store 1.2): denunciar foto, cartinha, pessoa e álbum público; bloquear pessoa.
 * - Denúncia: registrada no banco e enviada por email ao suporte (que responde em até 24 h, pelos Termos).
 *   Só denuncia o que a pessoa consegue ver (participa do diário, ou tem o link do álbum público).
 * - Bloqueio: quem bloqueia deixa de ver fotos e cartinhas da pessoa, não recebe avisos dela, e ela não entra
 *   pelos convites dos diários de quem bloqueou. Administrador ainda pode remover a pessoa do diário.
 */
import "server-only";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { adminClient, HttpError } from "./supabase";
import { must } from "./db";
import { sendReportToSupport } from "./mailer";

type Ctx = { supa: SupabaseClient; user: User };
const bad = (code: string, key: string) => new HttpError(400, code, key);

export const REPORT_REASONS = ["inappropriate", "harassment", "spam", "other"] as const;
const Report = z.object({
  targetType: z.enum(["entry", "letter", "user"]),
  targetId: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).optional().default(""),
  block: z.boolean().optional().default(false),
});
const DAILY_REPORTS = 20;

/** Diários em que a pessoa participa. */
async function myDogs(userId: string) {
  return new Set((((await must(adminClient().from("dog_members").select("dog_id").eq("user_id", userId), "errors.generic")) ?? []) as any[]).map((r) => r.dog_id as string));
}

/** Denunciar foto, cartinha ou pessoa (dentro do app). Opcionalmente bloqueia quem publicou. */
export async function reportContent(ctx: Ctx, args: unknown) {
  const a = Report.safeParse(args);
  if (!a.success) throw bad("INVALID", "errors.invalidRequest");
  const { targetType, targetId, reason, details, block } = a.data;
  const admin = adminClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error: countError } = await admin.from("content_reports").select("id", { count: "exact", head: true }).eq("reporter_id", ctx.user.id).gte("created_at", since);
  if (countError) throw new HttpError(500, "SERVER", "errors.saveFailed");
  if ((count ?? 0) >= DAILY_REPORTS) throw bad("TOO_MANY", "errors.tooManyReports");
  const mine = await myDogs(ctx.user.id);
  let dogId: string | null = null, author: string | null = null;
  if (targetType === "user") {
    // Só quem divide um diário com você (é quem pode ter visto algo).
    const shared = (((await must(admin.from("dog_members").select("dog_id").eq("user_id", targetId), "errors.generic")) ?? []) as any[]).find((r) => mine.has(r.dog_id));
    if (!shared || targetId === ctx.user.id) throw new HttpError(404, "NOT_FOUND", "errors.notFoundShort");
    dogId = shared.dog_id; author = targetId;
  } else {
    const table = targetType === "entry" ? "diary_entries" : "letters";
    const row = (await must(admin.from(table).select("dog_id, created_by").eq("id", targetId).maybeSingle(), "errors.generic")) as any;
    if (!row || !mine.has(row.dog_id)) throw new HttpError(404, "NOT_FOUND", "errors.notFoundShort");
    dogId = row.dog_id; author = row.created_by ?? null;
  }
  const { data, error } = await admin.from("content_reports").insert({ reporter_id: ctx.user.id, target_type: targetType, target_id: targetId, dog_id: dogId, reported_user_id: author, reason, details: details.trim() }).select("id").single();
  if (error) throw new HttpError(500, "SERVER", "errors.saveFailed");
  if (block && author && author !== ctx.user.id) await setBlock(ctx.user.id, author, true);
  await sendReportToSupport({ id: (data as any).id, targetType, targetId, dogId, reason, details: details.trim(), reporter: ctx.user.email ?? ctx.user.id });
  return { id: (data as any).id as string, blocked: !!(block && author && author !== ctx.user.id) };
}

/** Denunciar um álbum público (/s/<token>), sem conta. Limite por álbum para não virar spam. */
export async function reportShare(shareId: string, dogId: string | null, input: unknown) {
  const a = z.object({ reason: z.enum(REPORT_REASONS), details: z.string().max(1000).optional().default("") }).safeParse(input);
  if (!a.success) throw bad("INVALID", "errors.invalidRequest");
  const admin = adminClient();
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error: countError } = await admin.from("content_reports").select("id", { count: "exact", head: true }).eq("target_type", "share").eq("target_id", shareId).gte("created_at", since);
  if (countError) throw new HttpError(500, "SERVER", "errors.saveFailed");
  if ((count ?? 0) >= 10) throw bad("TOO_MANY", "errors.tooManyReports");
  const { data, error } = await admin.from("content_reports").insert({ target_type: "share", target_id: shareId, dog_id: dogId, reason: a.data.reason, details: a.data.details.trim() }).select("id").single();
  if (error) throw new HttpError(500, "SERVER", "errors.saveFailed");
  await sendReportToSupport({ id: (data as any).id, targetType: "share", targetId: shareId, dogId, reason: a.data.reason, details: a.data.details.trim(), reporter: "visitante do álbum público" });
  return { id: (data as any).id as string };
}

async function setBlock(blocker: string, blocked: string, on: boolean) {
  const admin = adminClient();
  if (on) await must(admin.from("user_blocks").upsert({ blocker_id: blocker, blocked_id: blocked }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true }));
  else await must(admin.from("user_blocks").delete().eq("blocker_id", blocker).eq("blocked_id", blocked));
}

/** Bloquear (ou desbloquear) alguém que divide (ou dividiu) um diário com você. */
export async function blockUser(ctx: Ctx, args: unknown) {
  const { userId, blocked } = z.object({ userId: z.string().uuid(), blocked: z.boolean() }).parse(args);
  if (userId === ctx.user.id) throw bad("INVALID", "errors.invalidRequest");
  if (blocked) {
    const mine = await myDogs(ctx.user.id);
    const theirs = (((await must(adminClient().from("dog_members").select("dog_id").eq("user_id", userId), "errors.generic")) ?? []) as any[]);
    if (!theirs.some((r) => mine.has(r.dog_id))) throw new HttpError(404, "NOT_FOUND", "errors.notFoundShort");
  }
  await setBlock(ctx.user.id, userId, blocked);
  return { blocked };
}

/** Quem esta pessoa bloqueou. */
export async function blockedBy(userId: string): Promise<string[]> {
  return (((await must(adminClient().from("user_blocks").select("blocked_id").eq("blocker_id", userId), "errors.generic")) ?? []) as any[]).map((r) => r.blocked_id);
}

/** Destes destinatários, quem bloqueou `actor` (não recebe avisos dele). */
export async function whoBlocked(actor: string, recipients: string[]): Promise<Set<string>> {
  if (!recipients.length) return new Set();
  return new Set((((await must(adminClient().from("user_blocks").select("blocker_id").eq("blocked_id", actor).in("blocker_id", recipients), "errors.generic")) ?? []) as any[]).map((r) => r.blocker_id));
}
