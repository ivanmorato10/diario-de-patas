/**
 * Formatação por idioma (datas, números, peso, dinheiro) com Intl. Pura: vale no navegador, no servidor e no PDF.
 * - Datas civis ("AAAA-MM-DD": aniversário, data da lembrança) são formatadas em UTC ao meio-dia:
 *   nunca mudam de dia por causa do fuso do aparelho (§12).
 * - Instantes (createdAt, pagamento) recebem o fuso explicitamente: idioma e fuso são coisas separadas.
 * - Peso: o banco guarda kg; libras só na entrada e na tela.
 */
import type { AppLocale, WeightUnit } from "./locale";

const CIVIL_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Meio-dia UTC da data civil: formatar com timeZone UTC devolve sempre o mesmo dia. */
export function civilToUtcNoon(d: string): Date | null {
  const m = CIVIL_RE.exec(d);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)) : null;
}

export type CivilStyle = "long" | "short" | "shortYear" | "weekday" | "numeric";

/** "18 de outubro de 2026" · "October 18, 2026"; short: "18 out" · "Oct 18"; shortYear: "18 out 25" · "Oct 18, 25"; numeric: 18/10/2026 · 10/18/2026. */
export function formatCivilDate(d: string, locale: AppLocale, style: CivilStyle = "long"): string {
  const date = civilToUtcNoon(d);
  if (!date) return d;
  if (style === "long") return new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(date);
  if (style === "numeric") return new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  if (style === "weekday") return new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(date);
  const out = new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short", ...(style === "shortYear" ? { year: "2-digit" } : {}) }).format(date);
  // pt-BR: "18 de out. de 25" → "18 out 25" (mais curto, como nos cartões).
  return locale === "pt-BR" ? out.replace(/ de /g, " ").replace(/\./g, "") : out;
}

/** Mês de uma linha do tempo: "Outubro de 2026" · "October 2026". */
export function formatMonthKey(key: string, locale: AppLocale): string {
  const date = civilToUtcNoon(`${key}-01`);
  if (!date) return key;
  const s = new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long", year: "numeric" }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Instante num fuso: "18 de outubro de 2026 14:05" · "October 18, 2026 at 2:05 PM". */
export function formatInstant(iso: string | Date, locale: AppLocale, timeZone: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }): string {
  return new Intl.DateTimeFormat(locale, { timeZone, ...opts }).format(new Date(iso));
}

/** Hora civil "HH:MM" (consultas): 19:15 · 7:15 PM. */
export function formatClock(hhmm: string, locale: AppLocale): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(new Date(Date.UTC(2000, 0, 1, Number(m[1]), Number(m[2]))));
}

export const formatNumber = (n: number, locale: AppLocale, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale, opts).format(n);

/** Libra internacional (exata). */
export const KG_PER_LB = 0.45359237;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
/** Entrada em libras vira kg com 3 casas: ida e volta mostram o mesmo número (27,6 lb → 12,519 kg → 27,6 lb). */
export const lbToKg = (lb: number) => Math.round(lb * KG_PER_LB * 1000) / 1000;
export const toKg = (value: number, unit: WeightUnit) => (unit === "lb" ? lbToKg(value) : value);
export const fromKg = (kg: number, unit: WeightUnit) => (unit === "lb" ? kgToLb(kg) : kg);

/** Peso na unidade da pessoa: "12,5 kg" · "27.6 lb". */
export function formatWeight(kg: number, unit: WeightUnit, locale: AppLocale, maxFractionDigits = 1): string {
  return `${formatNumber(fromKg(kg, unit), locale, { maximumFractionDigits: maxFractionDigits })} ${unit}`;
}

/**
 * Valor com a moeda da cobrança real (nunca convertida): em inglês, BRL aparece como "R$1.00 (BRL)"
 * para deixar claro que a cobrança é em reais.
 */
export function formatMoney(cents: number, currency: string, locale: AppLocale): string {
  const s = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "symbol" }).format(cents / 100);
  return locale === "en" && currency !== "USD" ? `${s} (${currency})` : s;
}
