/**
 * Idioma no servidor.
 * - Respostas (erros das operações): idioma de quem pediu — o mesmo cookie que define a tela.
 * - Avisos, push e emails: idioma de quem RECEBE (perfil de cada pessoa), nunca o de quem fez a ação.
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { createTranslator } from "next-intl";
import { MESSAGES } from "@/i18n/messages";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, isRegion, defaultRegion, resolveLocale, type AppLocale, type Region } from "@/i18n/locale";
import { adminClient } from "./supabase";
import { textOf } from "@/i18n/keys";

export const translator = (locale: AppLocale) => createTranslator({ locale, messages: MESSAGES[locale] });
export type ServerT = ReturnType<typeof translator>;

/** Idioma da requisição atual (cookie → navegador → pt-BR); fora de uma requisição, pt-BR. */
export async function requestLocale(): Promise<AppLocale> {
  try {
    return resolveLocale({ cookie: (await cookies()).get(LOCALE_COOKIE)?.value, acceptLanguage: (await headers()).get("accept-language") });
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Idioma salvo de cada pessoa (sem escolha: pt-BR, o idioma de quem já usava o app). */
export async function localesOf(userIds: string[]): Promise<Map<string, AppLocale>> {
  const out = new Map<string, AppLocale>(userIds.map((u) => [u, DEFAULT_LOCALE]));
  if (!userIds.length) return out;
  const { data } = await adminClient().from("profiles").select("user_id, locale").in("user_id", userIds);
  for (const r of (data ?? []) as { user_id: string; locale: string | null }[]) if (isLocale(r.locale)) out.set(r.user_id, r.locale);
  return out;
}

export async function localeOf(userId: string): Promise<AppLocale> {
  return (await localesOf([userId])).get(userId) ?? DEFAULT_LOCALE;
}

/** Região do calendário efetiva de um perfil (sem escolha: a sugestão do idioma). */
export const regionOf = (profile: { region?: string | null; locale?: string | null } | null | undefined): Region =>
  isRegion(profile?.region) ? profile.region : defaultRegion(isLocale(profile?.locale) ? profile.locale : DEFAULT_LOCALE);

/** Texto de uma chave vinda de um erro (`errors.x`, `validation.y?max=80`…); chave desconhecida volta como está. */
export function translateKey(t: ServerT, key: string, params?: Record<string, string | number>): string {
  return textOf(t, key, params);
}
