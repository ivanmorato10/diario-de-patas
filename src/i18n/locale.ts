/**
 * Idiomas do app (pt-BR e en) e preferências da pessoa que dependem dele. Puro: vale no navegador e no servidor.
 * O idioma é da PESSOA (perfil), não do cachorro: integrantes do mesmo diário podem usar idiomas diferentes.
 * Ordem para escolher o idioma: preferência salva no perfil → cookie → idioma do navegador → pt-BR.
 */
export const LOCALES = ["pt-BR", "en"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "pt-BR";

/** Cookie com o idioma escolhido (antes do login, e espelho do perfil depois). */
export const LOCALE_COOKIE = "ddp_locale";
export const LOCALE_COOKIE_MAX_AGE = 365 * 86_400;

/** Região do calendário (datas comemorativas): separada do idioma. */
export const REGIONS = ["BR", "US"] as const;
export type Region = (typeof REGIONS)[number];
/** Unidade de peso só na entrada e na tela; o banco guarda sempre kg. */
export const WEIGHT_UNITS = ["kg", "lb"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const isLocale = (v: unknown): v is AppLocale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
export const isRegion = (v: unknown): v is Region => typeof v === "string" && (REGIONS as readonly string[]).includes(v);
export const isWeightUnit = (v: unknown): v is WeightUnit => typeof v === "string" && (WEIGHT_UNITS as readonly string[]).includes(v);

/** "en-US", "en_GB", "EN" → en; "pt", "pt-PT", "pt-BR" → pt-BR; o resto não é suportado (null). */
export function normalizeLocale(tag: string | null | undefined): AppLocale | null {
  const base = tag?.trim().toLowerCase().split(/[-_]/)[0];
  if (base === "en") return "en";
  if (base === "pt") return "pt-BR";
  return null;
}

/** Primeiro idioma suportado do cabeçalho Accept-Language, respeitando a ordem de preferência (q). */
export function localeFromAcceptLanguage(header: string | null | undefined): AppLocale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => /^\s*q=([\d.]+)\s*$/.exec(p)?.[1]).find(Boolean);
      return { tag, q: q === undefined ? 1 : Number(q), i };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of ranked) {
    const l = normalizeLocale(tag);
    if (l) return l;
  }
  return null;
}

/** Idioma efetivo: perfil → cookie → navegador → pt-BR. Valores inválidos são ignorados. */
export function resolveLocale(src: { profile?: string | null; cookie?: string | null; acceptLanguage?: string | null }): AppLocale {
  if (isLocale(src.profile)) return src.profile;
  if (isLocale(src.cookie)) return src.cookie;
  return localeFromAcceptLanguage(src.acceptLanguage) ?? DEFAULT_LOCALE;
}

/** Sugestões quando a pessoa ainda não escolheu: inglês americano → EUA e libras; português → Brasil e kg. */
export const defaultRegion = (locale: AppLocale): Region => (locale === "en" ? "US" : "BR");
export const defaultWeightUnit = (locale: AppLocale): WeightUnit => (locale === "en" ? "lb" : "kg");

/** Cookie gravado pelo navegador (antes do login ou ao trocar o idioma). */
export function localeCookie(locale: AppLocale): string {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; secure" : "";
  return `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${secure}`;
}

/** Nome de cada idioma no próprio idioma (o seletor não traduz o nome do outro). */
export const LOCALE_NAMES: Record<AppLocale, string> = { "pt-BR": "Português (Brasil)", en: "English (US)" };
