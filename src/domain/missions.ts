import { LEVELS, MISSIONS, type MissionTemplate } from "@/config/catalog";
import { LIMITS } from "@/config/business";
import { civilDayNumber } from "./dates";
import type { CivilDate, DogPreferences } from "./types";

export function missionById(id: string): MissionTemplate | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export function missionBySlug(slug: string): MissionTemplate | undefined {
  return MISSIONS.find((m) => m.slug === slug);
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
  const available = MISSIONS.filter((m) => missionState(m, completed) === "available");
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

export function levelFor(xp: number): LevelInfo {
  let idx = 0;
  LEVELS.forEach((l, i) => {
    if (xp >= l.minXp) idx = i;
  });
  const next = LEVELS[idx + 1] ?? null;
  return { title: LEVELS[idx].title, xp, nextTitle: next?.title ?? null, nextAt: next?.minXp ?? null };
}
