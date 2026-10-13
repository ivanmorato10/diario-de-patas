import { LEVELS, MISSIONS, type MissionTemplate } from "@/config/catalog";
import { LIMITS } from "@/config/business";
import { civilDayNumber } from "./dates";
import { ALL_MISSIONS } from "./cycle";
import type { CivilDate, DogPreferences } from "./types";

/** Busca em todas as missões: únicas, do dia, itens de coleção e especiais (§7). */
export function missionById(id: string): MissionTemplate | undefined {
  return ALL_MISSIONS.find((m) => m.id === id);
}

export function missionBySlug(slug: string): MissionTemplate | undefined {
  return ALL_MISSIONS.find((m) => m.slug === slug);
}

/** Missão compatível com as preferências declaradas (§8.2, §9). */
export function matchesPreferences(m: MissionTemplate, prefs: DogPreferences): boolean {
  switch (m.context) {
    case "social-dogs":
      return prefs.socialDogs;
    case "people":
      return prefs.people;
    case "outdoor":
      return prefs.outdoor;
    case "home":
      return prefs.home;
    default:
      return true;
  }
}

export type MissionState = "completed" | "available" | "locked";

export function missionState(m: MissionTemplate, completed: ReadonlySet<string>): MissionState {
  if (completed.has(m.id)) return "completed";
  if (m.prerequisiteId && !completed.has(m.prerequisiteId)) return "locked";
  return "available";
}

/**
 * Até N sugestões do dia: disponíveis, não concluídas e compatíveis com preferências.
 * Rotação determinística por dia + deslocamento de "Trocar missão" (gratuito, §9).
 * Se as preferências esvaziarem a lista, cai para missões "any"/casa para nunca travar o usuário.
 */
export function dailySuggestions(
  completed: ReadonlySet<string>,
  prefs: DogPreferences,
  day: CivilDate,
  swapOffset = 0,
  limit: number = LIMITS.homeSuggestions,
): MissionTemplate[] {
  // Missões opcionais (datas especiais) não entram nas sugestões; ficam na lista para quem quiser.
  const available = MISSIONS.filter((m) => !m.optional && missionState(m, completed) === "available");
  let pool = available.filter((m) => matchesPreferences(m, prefs));
  if (pool.length === 0) pool = available.filter((m) => m.context === "any" || m.context === "home");
  if (pool.length === 0) return [];
  const start = (civilDayNumber(day) + swapOffset) % pool.length;
  const out: MissionTemplate[] = [];
  for (let i = 0; i < Math.min(limit, pool.length); i++) out.push(pool[(start + i) % pool.length]);
  return out;
}

export function totalCatalogXp(): number {
  return MISSIONS.reduce((s, m) => s + m.xp, 0);
}

export interface LevelInfo {
  title: string;
  xp: number;
  nextTitle: string | null;
  nextAt: number | null;
}

/** Depois do último nível, os níveis continuam a cada 250 XP: “Sempre juntos II, III…” (§7.3). */
export const ENDLESS_STEP = 250;

const ROMAN: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function roman(n: number): string {
  let out = "";
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}

export function levelFor(xp: number): LevelInfo {
  const last = LEVELS[LEVELS.length - 1];
  if (xp >= last.minXp) {
    const n = Math.floor((xp - last.minXp) / ENDLESS_STEP); // 0 = “Sempre juntos”, 1 = “II”…
    const title = n === 0 ? last.title : `${last.title} ${roman(n + 1)}`;
    return { title, xp, nextTitle: `${last.title} ${roman(n + 2)}`, nextAt: last.minXp + (n + 1) * ENDLESS_STEP };
  }
  let idx = 0;
  LEVELS.forEach((l, i) => {
    if (xp >= l.minXp) idx = i;
  });
  const next = LEVELS[idx + 1];
  return { title: LEVELS[idx].title, xp, nextTitle: next.title, nextAt: next.minXp };
}
