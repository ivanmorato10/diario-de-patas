/**
 * Ficha de cuidados (MUDANCAS-V2 §4). REGISTRO DO DONO, sem função veterinária:
 * o app guarda o que a pessoa digita, calcula datas e mostra lembretes. Não interpreta, não
 * diagnostica, não calcula doses e não dá conselho médico.
 * Privacidade: estes dados nunca entram em links compartilhados, analytics ou Open Graph.
 */
import { z } from "zod";
import { civilDayNumber, isCivilDate } from "./dates";
import type { CivilDate } from "./types";
import type { HealthDocument } from "./documents";

export const HEALTH_DISCLAIMER = "Estas anotações não substituem o veterinário. Em emergência, procure atendimento.";

/** Janela de “próxima em breve” e do cartão “Próximos cuidados”. */
export const CARE_WINDOW_DAYS = 30;

const civil = z.string().refine(isCivilDate, "Data inválida.");
const text = (max: number) => z.string().trim().max(max, `Use até ${max} caracteres.`);
const optionalText = (max: number) => text(max).default("");

// ---------- Dados do cachorro ----------
export const HealthProfileSchema = z.object({
  breed: optionalText(60),
  sex: z.enum(["female", "male"]).nullable().default(null),
  neutered: z.boolean().nullable().default(null),
  microchip: optionalText(40),
  coat: optionalText(60),
  allergies: optionalText(500),
  notes: optionalText(1000),
});
export type HealthProfileInput = z.input<typeof HealthProfileSchema>;
export type HealthProfileData = z.output<typeof HealthProfileSchema>;
export interface HealthProfile extends HealthProfileData {
  dogId: string;
  updatedAt: string;
}

// ---------- Peso ----------
export const WeightSchema = z.object({
  date: civil,
  kg: z.number().positive("Informe um peso maior que zero.").max(150, "Confira o peso informado."),
});
export type WeightInput = z.input<typeof WeightSchema>;
export interface WeightRecord extends z.output<typeof WeightSchema> {
  id: string;
  dogId: string;
  createdAt: string;
}

// ---------- Vacinas e vermífugos ----------
export const VACCINE_KINDS = { vaccine: "Vacina", dewormer: "Vermífugo", antiflea: "Antipulgas", other: "Outro" } as const;
export type VaccineKind = keyof typeof VACCINE_KINDS;

export const VaccineSchema = z
  .object({
    kind: z.enum(["vaccine", "dewormer", "antiflea", "other"]),
    name: text(80).min(1, "Informe o nome."),
    appliedDate: civil,
    nextDate: civil.nullable().default(null),
    clinic: optionalText(120),
    documentId: z.string().nullable().default(null),
  })
  .refine((v) => !v.nextDate || v.nextDate >= v.appliedDate, { message: "A próxima dose deve ser depois da aplicação.", path: ["nextDate"] });
export type VaccineInput = z.input<typeof VaccineSchema>;
export interface Vaccine extends z.output<typeof VaccineSchema> {
  id: string;
  dogId: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Consultas ----------
export const VisitSchema = z
  .object({
    date: civil,
    clinic: optionalText(120),
    vet: optionalText(120),
    reason: optionalText(200),
    notes: optionalText(2000),
    nextDate: civil.nullable().default(null),
    documentIds: z.array(z.string()).default([]),
  })
  .refine((v) => !v.nextDate || v.nextDate >= v.date, { message: "A próxima consulta deve ser depois desta.", path: ["nextDate"] });
export type VisitInput = z.input<typeof VisitSchema>;
export interface Visit extends z.output<typeof VisitSchema> {
  id: string;
  dogId: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Medicamentos ----------
export const MedicationSchema = z
  .object({
    name: text(80).min(1, "Informe o nome."),
    dose: optionalText(80),
    frequency: optionalText(80),
    /** Repetição para o aviso ("" = sem aviso; uso contínuo descrito em `frequency`). */
    repeat: z.enum(["", "daily", "weekly", "monthly", "quarterly", "yearly"]).default(""),
    /** Última dose marcada como dada (a próxima conta a partir dela). */
    lastGiven: civil.nullable().default(null),
    startDate: civil,
    endDate: civil.nullable().default(null),
    notes: optionalText(500),
  })
  .refine((m) => !m.endDate || m.endDate >= m.startDate, { message: "O fim deve ser depois do início.", path: ["endDate"] });
export type MedicationInput = z.input<typeof MedicationSchema>;
export interface Medication extends z.output<typeof MedicationSchema> {
  id: string;
  dogId: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Contatos ----------
export const CONTACT_KINDS = { vet: "Veterinário", clinic: "Clínica", emergency: "Emergência 24h", sitter: "Pet sitter", other: "Outro" } as const;
export type ContactKind = keyof typeof CONTACT_KINDS;

export const ContactSchema = z.object({
  kind: z.enum(["vet", "clinic", "emergency", "sitter", "other"]),
  name: text(80).min(1, "Informe o nome."),
  phone: optionalText(30).refine((p) => p === "" || /^[+\d][\d\s().-]{5,}$/.test(p), "Confira o telefone."),
  address: optionalText(200),
  notes: optionalText(500),
});
export type ContactInput = z.input<typeof ContactSchema>;
export interface Contact extends z.output<typeof ContactSchema> {
  id: string;
  dogId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthData {
  profile: HealthProfile | null;
  weights: WeightRecord[];
  vaccines: Vaccine[];
  visits: Visit[];
  medications: Medication[];
  contacts: Contact[];
  /** Só metadados; o arquivo fica num store separado (§5). */
  documents: HealthDocument[];
}

export const EMPTY_HEALTH: HealthData = { profile: null, weights: [], vaccines: [], visits: [], medications: [], contacts: [], documents: [] };

// ---------- Regras de data (puras e testadas) ----------

/** Dias de `today` até `date` (negativo = passou). Datas civis, sem conversão de fuso. */
export function daysUntil(date: CivilDate, today: CivilDate): number {
  return civilDayNumber(date) - civilDayNumber(today);
}

export function addDays(date: CivilDate, days: number): CivilDate {
  const d = new Date((civilDayNumber(date) + days) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export type DueStatus = "none" | "ok" | "soon" | "overdue";

/** Status de uma próxima data: em dia (> 30 dias), próxima em até 30 dias, ou atrasada. */
export function dueStatus(nextDate: CivilDate | null, today: CivilDate, windowDays = CARE_WINDOW_DAYS): DueStatus {
  if (!nextDate) return "none";
  const d = daysUntil(nextDate, today);
  if (d < 0) return "overdue";
  if (d <= windowDays) return "soon";
  return "ok";
}

export const DUE_LABEL: Record<DueStatus, string> = {
  none: "Sem próxima dose",
  ok: "Em dia",
  soon: "Próxima em até 30 dias",
  overdue: "Atrasada",
};

/** Texto curto da distância até a data, para acompanhar o rótulo (nunca só cor). */
export function dueText(nextDate: CivilDate, today: CivilDate): string {
  const d = daysUntil(nextDate, today);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d > 1) return `em ${d} dias`;
  if (d === -1) return "há 1 dia";
  return `há ${-d} dias`;
}

const vaccineKey = (v: Pick<Vaccine, "kind" | "name">) => `${v.kind}:${v.name.trim().toLocaleLowerCase("pt-BR")}`;

/**
 * Registro mais recente de cada vacina/vermífugo (mesmo tipo + nome). Uma dose nova “substitui”
 * a anterior: a próxima data da dose antiga não deve aparecer como atrasada.
 */
export function latestVaccines(vaccines: readonly Vaccine[]): Vaccine[] {
  const map = new Map<string, Vaccine>();
  for (const v of vaccines) {
    const k = vaccineKey(v);
    const cur = map.get(k);
    if (!cur || v.appliedDate > cur.appliedDate || (v.appliedDate === cur.appliedDate && v.createdAt > cur.createdAt)) map.set(k, v);
  }
  return [...map.values()];
}

/** Um registro antigo foi substituído por uma dose mais nova do mesmo item. */
export function isSuperseded(v: Vaccine, all: readonly Vaccine[]): boolean {
  return latestVaccines(all).every((l) => l.id !== v.id);
}

/** Em uso enquanto não tiver fim, ou até a data de fim (inclusive). Começo no futuro = ainda não. */
export function medicationActive(m: Pick<Medication, "startDate" | "endDate">, today: CivilDate): boolean {
  return m.startDate <= today && (!m.endDate || m.endDate >= today);
}

export const MED_REPEAT = { "": "Sem aviso", daily: "Todo dia", weekly: "Toda semana", monthly: "Todo mês", quarterly: "A cada 3 meses", yearly: "Todo ano" } as const;
export type MedRepeat = keyof typeof MED_REPEAT;

export function addMonths(date: CivilDate, months: number): CivilDate {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

/** Avança uma repetição a partir de uma data. */
export function nextRepeat(date: CivilDate, repeat: MedRepeat): CivilDate {
  switch (repeat) {
    case "daily": return addDays(date, 1);
    case "weekly": return addDays(date, 7);
    case "monthly": return addMonths(date, 1);
    case "quarterly": return addMonths(date, 3);
    case "yearly": return addMonths(date, 12);
    default: return date;
  }
}

/** Próxima dose: o início, ou a repetição seguinte à última dose dada. Null se sem aviso ou já terminou. */
export function medNextDue(m: Pick<Medication, "repeat" | "lastGiven" | "startDate" | "endDate">): CivilDate | null {
  if (!m.repeat) return null;
  const next = m.lastGiven ? nextRepeat(m.lastGiven, m.repeat) : m.startDate;
  return m.endDate && next > m.endDate ? null : next;
}

/** Remédios com dose para hoje ou atrasada (para o aviso na tela Hoje). */
export function medsDue(meds: Medication[], today: CivilDate) {
  return meds.map((m) => ({ m, due: medNextDue(m) })).filter((x): x is { m: Medication; due: CivilDate } => !!x.due && x.due <= today);
}

export interface CareItem {
  kind: "vaccine" | "visit" | "document" | "medication";
  id: string;
  title: string;
  date: CivilDate;
  status: Exclude<DueStatus, "none" | "ok">;
  href: string;
}

/** Próximos cuidados: próximas datas em até 30 dias e as atrasadas, mais urgentes primeiro; inclui validade de documentos. */
export function upcomingCare(h: Pick<HealthData, "vaccines" | "visits"> & { documents?: HealthDocument[]; medications?: Medication[] }, today: CivilDate, windowDays = CARE_WINDOW_DAYS): CareItem[] {
  const items: CareItem[] = [];
  for (const v of latestVaccines(h.vaccines)) {
    const s = dueStatus(v.nextDate, today, windowDays);
    if (s === "soon" || s === "overdue") items.push({ kind: "vaccine", id: v.id, title: `${VACCINE_KINDS[v.kind]}: ${v.name}`, date: v.nextDate!, status: s, href: "/cuidados/vacinas" });
  }
  // Consultas agendadas (data no futuro) aparecem como compromisso.
  for (const v of h.visits.filter((x) => x.date > today)) {
    const s = dueStatus(v.date, today, windowDays);
    if (s === "soon") items.push({ kind: "visit", id: v.id, title: `Consulta marcada${v.reason ? `: ${v.reason}` : ""}`, date: v.date, status: s, href: "/cuidados/consultas" });
  }
  // Consulta: só a próxima marcada mais recente conta (uma consulta nova cumpre a anterior).
  const lastVisit = [...h.visits].filter((x) => x.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (lastVisit?.nextDate) {
    const s = dueStatus(lastVisit.nextDate, today, windowDays);
    if (s === "soon" || s === "overdue") items.push({ kind: "visit", id: lastVisit.id, title: "Próxima consulta", date: lastVisit.nextDate, status: s, href: "/cuidados/consultas" });
  }
  for (const m of h.medications ?? []) {
    const due = medNextDue(m);
    const s = dueStatus(due, today, Math.min(windowDays, 7));
    if (due && (s === "soon" || s === "overdue")) items.push({ kind: "medication", id: m.id, title: `Remédio: ${m.name}`, date: due, status: s, href: "/cuidados/medicamentos" });
  }
  for (const d of h.documents ?? []) {
    const s = dueStatus(d.expiresOn, today, windowDays);
    if (s === "soon" || s === "overdue") items.push({ kind: "document", id: d.id, title: `Documento: ${d.title}`, date: d.expiresOn!, status: s, href: "/cuidados/documentos" });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

/** Mensagem do primeiro erro de validação, para mostrar junto do formulário. */
export function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Confira os dados.";
}
