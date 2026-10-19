import type { CivilDate } from "./types";

/** Fuso detectado pelo navegador; fallback seguro. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Data civil de um instante em um fuso — ex.: 23h em São Paulo continua sendo o mesmo dia. */
export function civilDateInTz(instant: Date, timeZone: string): CivilDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const CIVIL_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCivilDate(v: string): v is CivilDate {
  const m = CIVIL_RE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= daysInMonth;
}

/* Formatação por idioma (datas por extenso, meses): src/i18n/format.ts. */

export function monthKey(d: CivilDate): string {
  return d.slice(0, 7);
}

/** Dias desde a época para uma data civil — usado só para rotação determinística de sugestões. */
export function civilDayNumber(d: CivilDate): number {
  const m = CIVIL_RE.exec(d);
  if (!m) return 0;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}
