/**
 * Ciclo contínuo de missões (MUDANCAS-V2 §7) — regras puras e testadas.
 * Sem punição: nada aqui tira pontos, cria sequência obrigatória ou mensagem de culpa.
 */
import { MISSIONS, type MissionTemplate } from "@/config/catalog";
import {
  COLLECTION_ITEMS, DAILY_MISSIONS, DAILY_NO_REPEAT_DAYS, PERMANENT_SETS, SPECIAL_MISSIONS,
  type DailySlot, type PermanentSet, type PermanentSetId,
} from "@/config/cycle";
import { civilDayNumber, isCivilDate } from "./dates";
import { addDays } from "./health";
import type { CivilDate, DogPreferences } from "./types";
import type { Region } from "@/i18n/locale";

export const ALL_MISSIONS: MissionTemplate[] = [...MISSIONS, ...DAILY_MISSIONS, ...COLLECTION_ITEMS, ...SPECIAL_MISSIONS];

/** FNV-1a de 32 bits: sorteio determinístico e estável entre navegadores. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Missões do dia elegíveis para um espaço, respeitando as preferências do cadastro. */
export function eligibleDaily(slot: DailySlot, prefs: DogPreferences): MissionTemplate[] {
  const all = DAILY_MISSIONS.filter((m) => m.slot === slot);
  const ok = (m: MissionTemplate) =>
    m.context === "any" || (m.context === "home" && prefs.home) || (m.context === "people" && prefs.people) || (m.context === "outdoor" && prefs.outdoor) || (m.context === "social-dogs" && prefs.socialDogs && prefs.outdoor);
  // Quem não faz passeios: o espaço C vira retrato.
  const pool = slot === "C" && !prefs.outdoor ? all.filter((m) => m.portrait) : all.filter(ok);
  if (pool.length) return pool;
  return slot === "C" ? all.filter((m) => m.portrait) : all.filter((m) => m.context === "any" || m.context === "home");
}

/** Último dia em que cada missão do dia foi sugerida ou concluída. */
export type DailyHistory = ReadonlyMap<string, CivilDate>;

/**
 * Escolhe uma missão do espaço: evita o que foi sugerido/concluído nos últimos 14 dias enquanto houver
 * opção; se o espaço se esgotar, volta a mais antiga. Determinístico por hash(dogId + data + espaço + troca).
 */
export function pickDaily(
  slot: DailySlot, prefs: DogPreferences, dogId: string, date: CivilDate, history: DailyHistory, exclude: ReadonlySet<string> = new Set(), swap = 0,
): MissionTemplate {
  const pool = eligibleDaily(slot, prefs).filter((m) => !exclude.has(m.id));
  const base = pool.length ? pool : eligibleDaily(slot, prefs);
  const cutoff = civilDayNumber(date) - DAILY_NO_REPEAT_DAYS;
  const fresh = base.filter((m) => {
    const last = history.get(m.id);
    return !last || civilDayNumber(last) <= cutoff || civilDayNumber(last) > civilDayNumber(date);
  });
  let candidates = fresh;
  if (!candidates.length) {
    const oldest = Math.min(...base.map((m) => civilDayNumber(history.get(m.id) ?? "1970-01-01")));
    candidates = base.filter((m) => civilDayNumber(history.get(m.id) ?? "1970-01-01") === oldest);
  }
  return candidates[hash32(`${dogId}|${date}|${slot}|${swap}`) % candidates.length];
}

export interface DailyPlan {
  /** `${dogId}:${data}` */
  key: string;
  dogId: string;
  date: CivilDate;
  slots: Record<DailySlot, string>;
  /** Trocas feitas hoje por espaço (gratuitas, §7.1 regra 3). */
  swaps: Record<DailySlot, number>;
  /** Tudo o que já apareceu hoje em cada espaço — a troca não devolve o que acabou de sair. */
  shown: Record<DailySlot, string[]>;
  createdAt: string;
}

export function generatePlan(dogId: string, date: CivilDate, prefs: DogPreferences, history: DailyHistory, createdAt: string): DailyPlan {
  const slots = {} as Record<DailySlot, string>;
  for (const slot of ["A", "B", "C"] as const) slots[slot] = pickDaily(slot, prefs, dogId, date, history).id;
  return { key: `${dogId}:${date}`, dogId, date, slots, swaps: { A: 0, B: 0, C: 0 }, shown: { A: [slots.A], B: [slots.B], C: [slots.C] }, createdAt };
}

/** Troca a sugestão de um espaço por outra do mesmo espaço. */
export function swapInPlan(plan: DailyPlan, slot: DailySlot, prefs: DogPreferences, history: DailyHistory): DailyPlan {
  const swaps = { ...plan.swaps, [slot]: plan.swaps[slot] + 1 };
  let shown = plan.shown[slot];
  // Já mostrou tudo do espaço hoje? Recomeça a volta, sem repetir a atual.
  if (eligibleDaily(slot, prefs).every((m) => shown.includes(m.id))) shown = [plan.slots[slot]];
  const next = pickDaily(slot, prefs, plan.dogId, plan.date, history, new Set(shown), swaps[slot]);
  return { ...plan, slots: { ...plan.slots, [slot]: next.id }, swaps, shown: { ...plan.shown, [slot]: [...shown, next.id] } };
}

/** Histórico a partir de planos anteriores e conclusões de missões do dia. */
export function buildHistory(plans: readonly Pick<DailyPlan, "date" | "shown">[], dailyCompletions: readonly { missionId: string; date: CivilDate }[], before: CivilDate): Map<string, CivilDate> {
  const h = new Map<string, CivilDate>();
  const note = (id: string, d: CivilDate) => {
    if (d >= before) return;
    const cur = h.get(id);
    if (!cur || d > cur) h.set(id, d);
  };
  for (const p of plans) for (const ids of Object.values(p.shown)) for (const id of ids) note(id, p.date);
  for (const c of dailyCompletions) note(c.missionId, c.date);
  return h;
}

// ---------- Especiais ----------

export interface SpecialWindow {
  mission: MissionTemplate;
  /** Ano da ocorrência — a especial dá XP uma vez por ocorrência. */
  occurrence: string;
  start: CivilDate;
  end: CivilDate;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Thanksgiving (EUA): quarta quinta-feira de novembro, calculada para cada ano. */
export function thanksgivingDate(year: number): CivilDate {
  const firstWeekday = new Date(Date.UTC(year, 10, 1)).getUTCDay(); // 0 = domingo
  const firstThursday = 1 + ((4 - firstWeekday + 7) % 7);
  return `${year}-11-${pad(firstThursday + 21)}`;
}

/**
 * Especiais ativas hoje (§7.6). S01 só existe se a data de nascimento foi informada.
 * Região do calendário: Brasil mantém as datas de sempre; EUA somam National Dog Day e Thanksgiving.
 * A recompensa é por cachorro, missão e ano (instanceKey): trocar de região ou idioma não repete pontos.
 */
export function activeSpecials(today: CivilDate, birthDate: CivilDate | null, region: Region = "BR"): SpecialWindow[] {
  const y = Number(today.slice(0, 4));
  const out: SpecialWindow[] = [];
  const byId = (id: string) => SPECIAL_MISSIONS.find((m) => m.id === id)!;
  if (birthDate && isCivilDate(birthDate)) {
    for (const yy of [y - 1, y, y + 1]) {
      let md = birthDate.slice(5);
      if (md === "02-29" && !isLeap(yy)) md = "02-28";
      const day = `${yy}-${md}`;
      const start = addDays(day, -7), end = addDays(day, 7);
      if (today >= start && today <= end && yy >= Number(birthDate.slice(0, 4))) out.push({ mission: byId("S01"), occurrence: String(yy), start, end });
    }
  }
  const window = (id: string, start: CivilDate, end: CivilDate) => {
    const m = byId(id);
    if (m.region && m.region !== region) return;
    if (today >= start && today <= end) out.push({ mission: m, occurrence: String(y), start, end });
  };
  window("S02", `${y}-12-01`, `${y}-12-26`);
  window("S03", `${y}-10-24`, `${y}-10-31`);
  window("S04", `${y}-08-20`, `${y}-08-27`);
  const tg = thanksgivingDate(y);
  window("S05", addDays(tg, -3), addDays(tg, 3));
  return out;
}

// ---------- Chave de conclusão por tipo ----------

/** Instância que recebe XP: única para sempre, por dia sorteado ou por ocorrência da especial. */
export function instanceKey(dogId: string, m: MissionTemplate, today: CivilDate, occurrence?: string): string {
  if (m.kind === "daily") return `${dogId}:${m.id}:${today}`;
  if (m.kind === "special") return `${dogId}:${m.id}:${occurrence}`;
  return `${dogId}:${m.id}`;
}

// ---------- Coleções permanentes ----------

export interface SetProgress {
  set: PermanentSet;
  items: { missionId: string; done: boolean; entryId: string | null }[];
  done: number;
  complete: boolean;
}

/**
 * Progresso das coleções: um item conta se a missão dele foi concluída (inclusive antes desta mudança,
 * como M24) ou se uma missão do dia ligada a ele o avançou.
 */
export function setProgress(
  completions: readonly { missionId: string; instanceKey: string; entryId?: string | null }[],
  advanced: readonly { itemId: string; entryId: string | null }[],
): SetProgress[] {
  const direct = new Map<string, string | null>();
  for (const c of completions) if (!direct.has(c.missionId)) direct.set(c.missionId, c.entryId ?? null);
  const adv = new Map(advanced.map((a) => [a.itemId, a.entryId]));
  return PERMANENT_SETS.map((set) => {
    const items = set.items.map((id) => {
      const done = direct.has(id) || adv.has(id);
      return { missionId: id, done, entryId: direct.get(id) ?? adv.get(id) ?? null };
    });
    const n = items.filter((i) => i.done).length;
    return { set, items, done: n, complete: n === items.length };
  });
}

export function setsContaining(itemId: string): PermanentSetId[] {
  return PERMANENT_SETS.filter((s) => s.items.includes(itemId)).map((s) => s.id);
}

// ---------- Estado de uma missão para as telas ----------

export type CycleState = "completed" | "available" | "locked" | "not_today" | "out_of_window";

export interface CycleContext {
  dogId: string;
  /** Região do calendário de quem está usando (datas especiais). */
  region: Region;
  birthDate: CivilDate | null;
  today: CivilDate;
  plan: Pick<DailyPlan, "slots"> | null;
  completions: readonly { missionId: string; instanceKey: string }[];
  advances: readonly { itemId: string }[];
}

export function missionStatus(m: MissionTemplate, ctx: CycleContext): CycleState {
  const done = (id: string) => ctx.completions.some((c) => c.missionId === id);
  if (m.kind === "daily") {
    if (ctx.completions.some((c) => c.instanceKey === instanceKey(ctx.dogId, m, ctx.today))) return "completed";
    if (m.prerequisiteId && !done(m.prerequisiteId)) return "locked";
    return ctx.plan && Object.values(ctx.plan.slots).includes(m.id) ? "available" : "not_today";
  }
  if (m.kind === "special") {
    const w = activeSpecials(ctx.today, ctx.birthDate, ctx.region).find((x) => x.mission.id === m.id);
    if (!w) return "out_of_window";
    if (ctx.completions.some((c) => c.instanceKey === instanceKey(ctx.dogId, m, ctx.today, w.occurrence))) return "completed";
    return m.prerequisiteId && !done(m.prerequisiteId) ? "locked" : "available";
  }
  if (done(m.id) || (m.kind === "collection_item" && ctx.advances.some((a) => a.itemId === m.id))) return "completed";
  return m.prerequisiteId && !done(m.prerequisiteId) ? "locked" : "available";
}

/** Contagem simples de dias com lembranças — sem sequência que quebra (§7.3). */
export function daysWithMemories(entries: readonly { occurredDate: CivilDate }[]): number {
  return new Set(entries.map((e) => e.occurredDate)).size;
}

