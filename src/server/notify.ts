/**
 * Avisos da família: quando alguém guarda foto, escreve cartinha ou dá ossinho, as outras pessoas do
 * diário recebem um aviso (sininho "Novidades") e, se aceitaram, um push no celular.
 * - Quem fez a ação não recebe. Ossinho só avisa quem guardou a foto/escreveu a cartinha.
 * - Fotos em sequência da mesma pessoa viram UM aviso ("Ivan guardou 5 fotos de Pepe") e o push
 *   substitui o anterior no celular (mesma `tag`).
 * - Tudo roda depois da resposta (after): guardar uma foto não fica mais lento.
 */
import "server-only";
import { after } from "next/server";
import webpush from "web-push";
import { apnsReady, sendApns } from "./apns";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { adminClient, HttpError } from "./supabase";
import { must } from "./db";
import { nameFromUser } from "./family";
import { localesOf, requestLocale, translator, type ServerT } from "./i18n";
import { DEFAULT_LOCALE } from "@/i18n/locale";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctx = { supa: SupabaseClient; user: User };
export type NotifyKind = "photo" | "letter" | "bone" | "art";
const PREF: Record<NotifyKind, string> = { photo: "notify_photo", letter: "notify_letter", bone: "notify_bone", art: "notify_photo" };
const GROUP_MS = 2 * 3600_000; // fotos dentro de 2 h viram um aviso só (ver bump_photo_notice)

const pushReady = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/** Texto do aviso no sininho (uma linha), no idioma de quem RECEBE (`t`). Nomes nunca são traduzidos. */
export function noticeText(t: ServerT, n: { kind: NotifyKind; count: number; targetType: string | null }, actor: string, dog: string) {
  const v = { actor, dog, count: n.count };
  if (n.kind === "photo") return t("notices.photo", v);
  if (n.kind === "letter") return t("notices.letter", v);
  if (n.kind === "art") return t("notices.art", v);
  return t(n.targetType === "letter" ? "notices.boneLetter" : "notices.bonePhoto", v);
}

/**
 * Push no celular: título com quem fez e o que foi (o iPhone já mostra o nome do app embaixo; repetir
 * "Diário de Patas" no título soava frio) e um convite carinhoso no texto.
 */
export function pushText(t: ServerT, n: { kind: NotifyKind; count: number; targetType: string | null; detail?: string | null }, actor: string, dog: string) {
  const v = { actor, dog, count: n.count };
  if (n.kind === "photo") return { title: t("push.photoTitle", v), body: t("push.photoBody", v) };
  if (n.kind === "letter") return { title: t("push.letterTitle", v), body: t("push.letterBody", v) };
  if (n.kind === "art") {
    // `detail`: id do tema do Estúdio, com o nome no idioma de quem recebe.
    const key = `studioCatalog.presets.${n.detail}.label`;
    const theme = n.detail && t.has(key as never) ? t(key as never) : null;
    return { title: t("push.artTitle", v), body: theme ? t("push.artBodyTheme", { ...v, theme }) : t("push.artBody", v) };
  }
  return { title: t("push.boneTitle", v), body: t(n.targetType === "letter" ? "push.boneLetterBody" : "push.bonePhotoBody", v) };
}
/** Destino do aviso: /abrir confere o acesso, abre o cachorro certo e só então mostra a foto/cartinha. */
export const noticeUrl = (n: { dogId: string; targetType: string | null; targetId: string | null }) =>
  `/abrir?cao=${n.dogId}${n.targetId ? `&${n.targetType === "letter" ? "carta" : "foto"}=${n.targetId}` : ""}`;

async function displayName(userId: string, fallback?: User) {
  const admin = adminClient();
  const { data } = await admin.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
  const n = (data as any)?.display_name as string | undefined;
  if (n) return n;
  if (fallback?.email || fallback?.user_metadata) return nameFromUser(fallback);
  const { data: u } = await admin.auth.admin.getUserById(userId);
  return nameFromUser(u.user);
}

/** Envia para os aparelhos da pessoa. Devolve quantos o serviço de push ACEITOU (não é confirmação de entrega). */
async function sendPush(userId: string, payload: { title: string; body: string; url: string; tag: string; renotify?: boolean }) {
  const res = { devices: 0, accepted: 0 };
  if (!pushReady() && !apnsReady()) return res;
  if (pushReady()) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:diariodepatas.app@gmail.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const admin = adminClient();
  const subs = ((await admin.from("push_subscriptions").select("id, kind, endpoint, p256dh, auth").eq("user_id", userId)).data ?? []) as any[];
  res.devices = subs.length;
  await Promise.all(subs.map(async (s) => {
    // App do iPhone: pela Apple (APNs).
    if (s.kind === "apns") {
      if (!apnsReady()) return;
      const r = await sendApns(String(s.endpoint).slice("apns:".length), payload);
      if (r.ok) res.accepted++;
      else if (r.gone) await admin.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("apns", r.status, r.reason ?? "");
      return;
    }
    if (!pushReady()) return;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 24 * 3600 });
      res.accepted++;
    } catch (e: any) {
      // Aparelho que desinstalou ou recusou: tira da lista.
      if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("push", e?.statusCode ?? "", e?.body ?? (e instanceof Error ? e.message : e));
    }
  }));
  return res;
}

/** Registra o aviso para a família e manda o push (depois da resposta). */
/** `now: true` envia já (quem chama já está fora da resposta, como o fim de uma arte); senão roda depois da resposta. */
export function notifyFamily(ctx: { user: User }, a: { dogId: string; dogName: string; kind: NotifyKind; targetType: "entry" | "letter"; targetId: string; authorId?: string | null; detail?: string | null; now?: boolean }) {
  const run = async () => {
    const admin = adminClient();
    const actor = ctx.user.id;
    let recipients: string[];
    if (a.kind === "bone") recipients = a.authorId && a.authorId !== actor ? [a.authorId] : [];
    else recipients = (((await admin.from("dog_members").select("user_id").eq("dog_id", a.dogId)).data ?? []) as any[]).map((m) => m.user_id).filter((u) => u !== actor);
    if (!recipients.length) return;
    const prefs = ((await admin.from("profiles").select(`user_id, ${PREF[a.kind]}`).in("user_id", recipients)).data ?? []) as any[];
    const off = new Set(prefs.filter((p) => p[PREF[a.kind]] === false).map((p) => p.user_id));
    recipients = recipients.filter((u) => !off.has(u));
    if (!recipients.length) return;
    const actorName = await displayName(actor, ctx.user);
    const locales = await localesOf(recipients); // cada pessoa recebe no próprio idioma
    await Promise.all(recipients.map(async (uid) => {
      const t = translator(locales.get(uid) ?? DEFAULT_LOCALE);
      let count = 1;
      if (a.kind === "photo") {
        // No banco, com trava: envios simultâneos somam no mesmo aviso.
        const { data: n, error } = await admin.rpc("bump_photo_notice", { p_user: uid, p_dog: a.dogId, p_actor: actor, p_target: a.targetId, p_window: `${GROUP_MS / 1000} seconds` });
        if (error) throw new Error(`bump_photo_notice: ${error.message}`);
        count = Number(n) || 1;
      } else {
        // Ossinho dado, tirado e dado de novo não vira dois avisos.
        const { data: dup } = await admin.from("notifications").select("id").eq("user_id", uid).eq("actor_id", actor).eq("kind", a.kind).eq("target_id", a.targetId).limit(1).maybeSingle();
        if (dup) return;
        const { error } = await admin.from("notifications").insert({ user_id: uid, dog_id: a.dogId, actor_id: actor, kind: a.kind, target_type: a.targetType, target_id: a.targetId });
        if (error) throw new Error(`aviso ${a.kind}: ${error.message}`);
      }
      const { title, body } = pushText(t, { kind: a.kind, count, targetType: a.targetType, detail: a.detail }, actorName, a.dogName);
      // Atualização do mesmo grupo substitui o aviso no celular SEM tocar/vibrar de novo.
      await sendPush(uid, { title, body, url: noticeUrl(a), tag: a.kind === "photo" ? `photo:${a.dogId}:${actor}` : `${a.kind}:${a.targetId}`, renotify: count === 1 });
    }));
  };
  const safe = () => run().catch((e) => console.error("aviso da família:", e instanceof Error ? e.message : e));
  if (a.now) return safe();
  after(safe);
}

// ---------- RPC ----------

export async function listNotifications(ctx: Ctx) {
  const admin = adminClient();
  // Erro do banco é erro (nunca "sem avisos"): a tela mostra "não deu para carregar" com tentar de novo.
  const rows = ((await must(ctx.supa.from("notifications").select("*").eq("user_id", ctx.user.id).order("created_at", { ascending: false }).limit(40), "errors.generic")) ?? []) as any[];
  const dogIds = [...new Set(rows.map((r) => r.dog_id))];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
  const [dogs, profs] = await Promise.all([
    dogIds.length ? admin.from("dogs").select("id, name").in("id", dogIds) : Promise.resolve({ data: [] }),
    actorIds.length ? admin.from("profiles").select("user_id, display_name").in("user_id", actorIds) : Promise.resolve({ data: [] }),
  ]);
  const dogName = new Map(((dogs.data ?? []) as any[]).map((d) => [d.id, d.name]));
  const actorName = new Map(((profs.data ?? []) as any[]).map((p) => [p.user_id, p.display_name]));
  const t = translator(await requestLocale()); // lista vista agora: o idioma da tela de quem abre
  return rows.map((r) => {
    const n = { kind: r.kind as NotifyKind, count: r.count as number, dogId: r.dog_id as string, targetType: r.target_type as string | null, targetId: r.target_id as string | null };
    return { id: r.id, dogId: r.dog_id, read: !!r.read_at, createdAt: r.created_at, text: noticeText(t, n, actorName.get(r.actor_id) || t("notices.someone"), dogName.get(r.dog_id) ?? t("notices.theDog")), url: noticeUrl(n) };
  });
}

/** Só a contagem do sininho (leve: consultada a cada minuto e ao voltar para o app). */
export async function unreadCount(ctx: Ctx) {
  const { count, error } = await ctx.supa.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id).is("read_at", null);
  if (error) throw new HttpError(500, "SERVER", "errors.generic");
  return { unread: count ?? 0 };
}

/** Marca como lidos SÓ os avisos que a pessoa viu (os que chegarem depois continuam novos). */
export async function markNotificationsRead(ctx: Ctx, args: unknown) {
  const { ids } = z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(args);
  if (ids.length) await must(adminClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", ctx.user.id).in("id", ids).is("read_at", null));
  return {};
}

const Sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export async function savePushSubscription(ctx: Ctx, args: unknown) {
  const { endpoint, keys } = Sub.parse((args as any)?.subscription ?? args);
  const ua = String((args as any)?.userAgent ?? "").slice(0, 200);
  await must(adminClient().from("push_subscriptions").upsert({ user_id: ctx.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: ua }, { onConflict: "endpoint" }));
  return { ok: true };
}

export async function removePushSubscription(ctx: Ctx, args: unknown) {
  const { endpoint } = z.object({ endpoint: z.string() }).parse(args);
  await must(adminClient().from("push_subscriptions").delete().eq("user_id", ctx.user.id).eq("endpoint", endpoint));
  return {};
}

export async function setNotifyPrefs(ctx: Ctx, args: unknown) {
  // Só os campos que vieram mudam: dois toques seguidos (fotos e cartinhas) não desfazem um ao outro.
  const a = z.object({ photo: z.boolean().optional(), letter: z.boolean().optional(), bone: z.boolean().optional() }).parse(args);
  const row: Record<string, unknown> = { user_id: ctx.user.id };
  if (a.photo !== undefined) row.notify_photo = a.photo;
  if (a.letter !== undefined) row.notify_letter = a.letter;
  if (a.bone !== undefined) row.notify_bone = a.bone;
  const { error } = await adminClient().from("profiles").upsert(row, { onConflict: "user_id" });
  if (error) throw new HttpError(500, "SERVER", "errors.saveFailed");
  return {};
}

/** App do iPhone: liga os avisos deste aparelho (token da Apple) à conta que está usando agora. */
export async function saveNativePush(ctx: Ctx, args: unknown) {
  const { token } = z.object({ token: z.string().regex(/^[0-9a-fA-F]{32,200}$/) }).parse(args);
  await must(adminClient().from("push_subscriptions").upsert({ user_id: ctx.user.id, kind: "apns", endpoint: `apns:${token.toLowerCase()}`, p256dh: null, auth: null, user_agent: "ios-app" }, { onConflict: "endpoint" }));
  return {};
}

/** Teste: manda um aviso só para você. Diz a verdade: sem configuração ou sem aparelho, não "enviou". */
export async function testPush(ctx: Ctx) {
  if (!pushReady() && !apnsReady()) return { configured: false, devices: 0, accepted: 0 };
  const t = translator((await localesOf([ctx.user.id])).get(ctx.user.id) ?? DEFAULT_LOCALE);
  const r = await sendPush(ctx.user.id, { title: "Diário de Patas", body: t("push.test"), url: "/novidades", tag: "teste", renotify: true });
  return { configured: true, ...r };
}

/**
 * Este aparelho está registrado para ESTA conta? Se o mesmo aparelho estava ligado a outra conta
 * (alguém saiu sem desligar, ou a sessão expirou), a ligação antiga é desfeita: avisos de uma conta
 * nunca chegam no aparelho de outra.
 */
export async function checkPushSubscription(ctx: Ctx, args: unknown) {
  const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(args);
  const admin = adminClient();
  const data = await must(admin.from("push_subscriptions").select("user_id").eq("endpoint", endpoint).maybeSingle(), "errors.generic");
  const owner = (data as any)?.user_id as string | undefined;
  if (owner && owner !== ctx.user.id) await must(admin.from("push_subscriptions").delete().eq("endpoint", endpoint));
  return { registered: owner === ctx.user.id };
}
