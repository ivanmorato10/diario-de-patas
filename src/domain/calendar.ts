/**
 * Datas comemorativas do Estúdio por região do calendário (separada do idioma: dá para usar inglês com datas do Brasil).
 * Ordem das sugestões: primeiro as da região da pessoa que estão chegando (até 45 dias), depois as outras da região,
 * e por fim as de outra região — todas continuam acessíveis; trocar de região não apaga temas, artes nem histórico.
 */
import type { StudioPreset } from "@/config/studio";
import { thanksgivingDate } from "./cycle";
import { addDays, daysUntil } from "./health";
import type { Region } from "@/i18n/locale";
import type { CivilDate } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Domingo de Páscoa (algoritmo gregoriano anônimo). */
export function easterDate(y: number): CivilDate {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${pad(month)}-${pad(day)}`;
}

/** Dia de cada tema de data num ano (temas sem dia fixo, como aniversário, ficam fora). */
export function themeDate(id: string, y: number): CivilDate | null {
  switch (id) {
    case "natal": return `${y}-12-25`;
    case "halloween": return `${y}-10-31`;
    case "dia-dos-animais": return `${y}-10-04`;
    case "festa-junina": return `${y}-06-24`;
    case "pascoa": return easterDate(y);
    case "ano-novo": return `${y}-12-31`;
    case "national-dog-day": return `${y}-08-26`;
    case "thanksgiving": return thanksgivingDate(y);
    default: return null;
  }
}

/** Próxima ocorrência do tema a partir de hoje (inclui hoje). */
export function nextThemeDate(id: string, today: CivilDate): CivilDate | null {
  const y = Number(today.slice(0, 4));
  for (const yy of [y, y + 1]) {
    const d = themeDate(id, yy);
    if (d && d >= today) return d;
  }
  return null;
}

export const UPCOMING_DAYS = 45;

/** Tema chegando: até 45 dias (e só da região da pessoa, ou de todas). */
export function isUpcoming(p: Pick<StudioPreset, "id" | "region">, region: Region, today: CivilDate): boolean {
  if (p.region && p.region !== region) return false;
  const d = nextThemeDate(p.id, today);
  return !!d && daysUntil(d, today) <= UPCOMING_DAYS;
}

/** Ordena os temas de data: chegando (mais perto primeiro) → resto da região → outra região. Estável. */
export function orderDatePresets<T extends Pick<StudioPreset, "id" | "region">>(list: T[], region: Region, today: CivilDate): T[] {
  const rank = (p: T) => (p.region && p.region !== region ? 2 : isUpcoming(p, region, today) ? 0 : 1);
  const soon = (p: T) => (rank(p) === 0 ? daysUntil(nextThemeDate(p.id, today) ?? addDays(today, 999), today) : 0);
  return list.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || soon(a.p) - soon(b.p) || a.i - b.i).map((x) => x.p);
}
