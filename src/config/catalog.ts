/**
 * Seeds versionados do catálogo (briefing §9, §11, §12, §21).
 * Fonte única para UI, domínio e para o seed SQL (supabase/seed.sql deve espelhar este arquivo).
 * Os textos (títulos, descrições, critérios) ficam em messages/<idioma>.json → catalog.*, com {dog} explícito.
 */
import type { Region } from "@/i18n/locale";

export const CATALOG_VERSION = 2;

export type SpecialTheme = "aniversario" | "halloween" | "natal" | "national-dog-day" | "thanksgiving";

export type CollectionId =
  | "primeiras-lembrancas"
  | "vida-em-casa"
  | "nosso-vinculo"
  | "pequenas-aventuras"
  | "manias-e-expressoes"
  | "estacoes-e-datas"
  | "cuidados"
  | "datas-especiais";

export interface Collection {
  id: CollectionId;
  /** Datas especiais abriga só as artes do Estúdio; não tem missões (MUDANCAS-V2 §3). */
  hasMissions: boolean;
}

export const COLLECTIONS: Collection[] = [
  { id: "primeiras-lembrancas", hasMissions: true },
  { id: "vida-em-casa", hasMissions: true },
  { id: "nosso-vinculo", hasMissions: true },
  { id: "pequenas-aventuras", hasMissions: true },
  { id: "manias-e-expressoes", hasMissions: true },
  { id: "estacoes-e-datas", hasMissions: true },
  { id: "cuidados", hasMissions: true },
  { id: "datas-especiais", hasMissions: false },
];

/** Contexto usado para respeitar preferências (§9: sociais só se permitido; externas têm alternativas internas). */
export type MissionContext = "home" | "outdoor" | "social-dogs" | "people" | "any";

/** Tipo da missão (MUDANCAS-V2 §7): única, do dia, item de coleção permanente ou especial. */
export type MissionKind = "once" | "daily" | "collection_item" | "special";

export interface MissionTemplate {
  id: string; // M01..M48 (únicas), D01..D36 (do dia), C01..C15 (coleções), S01..S03 (especiais)
  kind: MissionKind;
  slug: string;
  /** Título, descrição e critério visual: catalog.missions.<id> nos arquivos de idioma. */
  xp: number;
  collectionId: CollectionId;
  context: MissionContext;
  prerequisiteId: string | null;
  /** Critério subjetivo: validar somente requisitos objetivos mínimos (§10). */
  subjective: boolean;
  acceptsGallery: boolean;
  /** Missão de data especial: opcional, nunca é pré-requisito de nada (MUDANCAS-V2 §3). */
  optional?: boolean;
  /** Missões externas sempre têm uma alternativa em casa (§9, MUDANCAS-V2 §3): catalog.missions.<id>.homeAlternative. */
  homeAlternative?: boolean;
  /** Missão do dia: espaço do sorteio (§7.1). */
  slot?: "A" | "B" | "C";
  /** Missão do dia de retrato — serve para quem não passeia (†). */
  portrait?: boolean;
  /** Item de coleção que esta missão do dia avança, sem XP extra (§7.1, regra 6). */
  advancesItem?: string;
  /** Tema do Estúdio ligado à especial (§7.6). */
  studioTheme?: SpecialTheme;
  /** Especial de uma região do calendário (sem região = todas). */
  region?: Region;
  version: number;
}

const base = { acceptsGallery: true, version: 1, subjective: false, kind: "once" } as const;

export const MISSIONS: MissionTemplate[] = [
  { ...base, id: "M01", slug: "ola-mundo", xp: 10, collectionId: "primeiras-lembrancas", context: "any", prerequisiteId: null },
  { ...base, id: "M02", slug: "soneca-de-respeito", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M03", slug: "meu-brinquedo", xp: 15, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M04", slug: "hora-da-refeicao", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M05", slug: "meu-cantinho", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M06", slug: "dupla-inseparavel", xp: 15, collectionId: "nosso-vinculo", context: "people", prerequisiteId: "M01" },
  { ...base, id: "M07", slug: "explorador-do-parque", xp: 20, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: true },
  { ...base, id: "M08", slug: "pe-na-rua", xp: 15, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: true },
  { ...base, id: "M09", slug: "amizade-de-patas", xp: 20, collectionId: "pequenas-aventuras", context: "social-dogs", prerequisiteId: "M01" },
  { ...base, id: "M10", slug: "momento-engracado", xp: 10, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01", subjective: true },
  { ...base, id: "M11", slug: "companhia-tranquila", xp: 15, collectionId: "nosso-vinculo", context: "people", prerequisiteId: "M01" },
  { ...base, id: "M12", slug: "cara-de-capa", xp: 10, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01" },
  // MUDANCAS-V2 §3 — pré-requisito M01, fotos antigas valem.
  { ...base, id: "M13", slug: "primeiro-dia-em-casa", xp: 15, collectionId: "primeiras-lembrancas", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M14", slug: "patinha-de-perto", xp: 10, collectionId: "primeiras-lembrancas", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M15", slug: "meu-nome", xp: 10, collectionId: "primeiras-lembrancas", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M16", slug: "bocejo-flagrado", xp: 15, collectionId: "manias-e-expressoes", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M17", slug: "posicao-estranha-de-dormir", xp: 15, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M18", slug: "esperando-na-porta", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M19", slug: "hora-do-banho", xp: 15, collectionId: "cuidados", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M20", slug: "cheiroso", xp: 10, collectionId: "cuidados", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M21", slug: "dia-de-chuva", xp: 10, collectionId: "estacoes-e-datas", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M22", slug: "esconderijo-favorito", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M23", slug: "dono-do-sofa", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M24", slug: "selfie-juntos", xp: 15, collectionId: "nosso-vinculo", context: "people", prerequisiteId: "M01" },
  { ...base, id: "M25", slug: "patinha-na-mao", xp: 15, collectionId: "nosso-vinculo", context: "people", prerequisiteId: "M01" },
  { ...base, id: "M26", slug: "colo-bom", xp: 10, collectionId: "nosso-vinculo", context: "people", prerequisiteId: "M01" },
  { ...base, id: "M27", slug: "familia-reunida", xp: 20, collectionId: "nosso-vinculo", context: "people", prerequisiteId: "M01" },
  { ...base, id: "M28", slug: "bom-dia", xp: 10, collectionId: "nosso-vinculo", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M29", slug: "boa-noite", xp: 10, collectionId: "nosso-vinculo", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M30", slug: "cabeca-inclinada", xp: 15, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M31", slug: "lingua-de-fora", xp: 10, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M32", slug: "orelhas-em-acao", xp: 10, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M33", slug: "cara-de-culpado", xp: 15, collectionId: "manias-e-expressoes", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M34", slug: "truque-favorito", xp: 20, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M35", slug: "brinquedo-sobrevivente", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M36", slug: "correria", xp: 15, collectionId: "pequenas-aventuras", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M37", slug: "novo-caminho", xp: 20, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: true },
  { ...base, id: "M38", slug: "por-do-sol", xp: 15, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: true },
  { ...base, id: "M39", slug: "pegadas", xp: 15, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: true },
  { ...base, id: "M40", slug: "lugar-pet-friendly", xp: 20, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: true },
  { ...base, id: "M41", slug: "na-estrada", xp: 15, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: true },
  { ...base, id: "M42", slug: "dia-de-praia", xp: 20, collectionId: "estacoes-e-datas", context: "outdoor", prerequisiteId: "M01", optional: true, homeAlternative: true },
  { ...base, id: "M43", slug: "dia-de-frio", xp: 10, collectionId: "estacoes-e-datas", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M44", slug: "dia-de-calor", xp: 10, collectionId: "estacoes-e-datas", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M45", slug: "feliz-aniversario", xp: 20, collectionId: "estacoes-e-datas", context: "any", prerequisiteId: "M01", optional: true },
  { ...base, id: "M46", slug: "natal-juntos", xp: 15, collectionId: "estacoes-e-datas", context: "home", prerequisiteId: "M01", optional: true },
  { ...base, id: "M47", slug: "visita-ao-veterinario", xp: 15, collectionId: "cuidados", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M48", slug: "unhas-e-tosa", xp: 10, collectionId: "cuidados", context: "any", prerequisiteId: "M01" },
];

/** Nome de cada nível: catalog.levels.l<índice>. */
export interface Level {
  minXp: number;
}

/** Catálogo de 48 missões = 650 XP; o maior nível (500) é alcançável — há um teste para isso (MUDANCAS-V2 §3). */
export const LEVELS: Level[] = [
  { minXp: 0 },
  { minXp: 30 },
  { minXp: 70 },
  { minXp: 120 },
  { minXp: 220 },
  { minXp: 350 },
  { minXp: 500 },
];
