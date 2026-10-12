/**
 * Seeds versionados do catálogo (briefing §9, §11, §12, §21).
 * Fonte única para UI, domínio e para o seed SQL (supabase/seed.sql deve espelhar este arquivo).
 */
export const CATALOG_VERSION = 1;

export type CollectionId =
  | "primeiras-lembrancas"
  | "vida-em-casa"
  | "nosso-vinculo"
  | "pequenas-aventuras"
  | "manias-e-expressoes"
  | "datas-especiais";

export interface Collection {
  id: CollectionId;
  title: string;
  description: string;
  /** Datas especiais abriga artes do estúdio; não tem missões. */
  hasMissions: boolean;
}

export const COLLECTIONS: Collection[] = [
  { id: "primeiras-lembrancas", title: "Primeiras lembranças", description: "O começo do diário.", hasMissions: true },
  { id: "vida-em-casa", title: "Vida em casa", description: "Sonecas, brinquedos e cantinhos.", hasMissions: true },
  { id: "nosso-vinculo", title: "Nosso vínculo", description: "Momentos de companhia.", hasMissions: true },
  { id: "pequenas-aventuras", title: "Pequenas aventuras", description: "Passeios e descobertas lá fora.", hasMissions: true },
  { id: "manias-e-expressoes", title: "Manias e expressões", description: "Caras, jeitos e retratos.", hasMissions: true },
  { id: "datas-especiais", title: "Datas especiais", description: "Artes comemorativas do estúdio.", hasMissions: false },
];

/** Contexto usado para respeitar preferências (§9: sociais só se permitido; externas têm alternativas internas). */
export type MissionContext = "home" | "outdoor" | "social-dogs" | "people" | "any";

export interface MissionTemplate {
  id: string; // M01..M12
  slug: string;
  title: string;
  description: string;
  /** Critério visual observável — único objeto da validação. */
  criterion: string;
  xp: number;
  collectionId: CollectionId;
  context: MissionContext;
  prerequisiteId: string | null;
  /** Critério subjetivo: validar somente requisitos objetivos mínimos (§10). */
  subjective: boolean;
  acceptsGallery: boolean;
  version: number;
}

const base = { acceptsGallery: true, version: 1, subjective: false } as const;

export const MISSIONS: MissionTemplate[] = [
  { ...base, id: "M01", slug: "ola-mundo", title: "Olá, mundo", description: "A primeira página do diário: uma foto em que dê para ver bem o seu cachorro.", criterion: "Cachorro claramente visível.", xp: 10, collectionId: "primeiras-lembrancas", context: "any", prerequisiteId: null },
  { ...base, id: "M02", slug: "soneca-de-respeito", title: "Soneca de respeito", description: "Aquele momento de descanso que merece registro.", criterion: "Cachorro deitado ou descansando. Se está dormindo de verdade pode ficar incerto — tudo bem.", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M03", slug: "meu-brinquedo", title: "Meu brinquedo", description: "O brinquedo favorito, o mais roído ou o do momento.", criterion: "Cachorro e um brinquedo visíveis na foto.", xp: 15, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M04", slug: "hora-da-refeicao", title: "Hora da refeição", description: "Na refeição de sempre — nada de comida extra para a foto.", criterion: "Cachorro junto ao pote ou à comida habitual.", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M05", slug: "meu-cantinho", title: "Meu cantinho", description: "Sofá, tapete, caminha ou aquele canto que só ele escolheu.", criterion: "Cachorro em um local de descanso (não precisa ser cama comprada).", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M06", slug: "dupla-inseparavel", title: "Dupla inseparável", description: "Você e seu cachorro (ou alguém da família) na mesma foto.", criterion: "Cachorro junto de uma pessoa. Ninguém é identificado.", xp: 15, collectionId: "nosso-vinculo", context: "people", prerequisiteId: "M01" },
  { ...base, id: "M07", slug: "explorador-do-parque", title: "Explorador do parque", description: "Um passeio com grama, árvores ou jardim por perto.", criterion: "Cachorro em ambiente externo com cara de parque ou jardim.", xp: 20, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01" },
  { ...base, id: "M08", slug: "pe-na-rua", title: "Pé na rua", description: "Qualquer passeio vale — perto ou longe.", criterion: "Cachorro em um passeio ao ar livre.", xp: 15, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01" },
  { ...base, id: "M09", slug: "amizade-de-patas", title: "Amizade de patas", description: "Quando aparece mais alguém de quatro patas.", criterion: "Dois ou mais cachorros enquadrados. Não precisam estar encostados.", xp: 20, collectionId: "pequenas-aventuras", context: "social-dogs", prerequisiteId: "M01" },
  { ...base, id: "M10", slug: "momento-engracado", title: "Momento engraçado", description: "Você decide o que é engraçado. A gente só guarda.", criterion: "Cachorro na foto. O humor é seu — não é avaliado.", xp: 10, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01", subjective: true },
  { ...base, id: "M11", slug: "companhia-tranquila", title: "Companhia tranquila", description: "Um descanso lado a lado.", criterion: "Cachorro descansando perto de uma pessoa.", xp: 15, collectionId: "nosso-vinculo", context: "people", prerequisiteId: "M01" },
  { ...base, id: "M12", slug: "cara-de-capa", title: "Cara de capa", description: "Um retrato digno da capa do álbum.", criterion: "Retrato com o cachorro claramente visível.", xp: 10, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01" },
];

export interface Level {
  minXp: number;
  title: string;
}

/** Soma do catálogo inicial = 160 XP; o maior nível (120) é alcançável (§9). */
export const LEVELS: Level[] = [
  { minXp: 0, title: "Novo companheiro" },
  { minXp: 30, title: "Colecionador de momentos" },
  { minXp: 70, title: "Explorador" },
  { minXp: 120, title: "Guardião de lembranças" },
];

export interface StudioTheme {
  id: "aniversario" | "halloween" | "natal";
  title: string;
  description: string;
}

export const STUDIO_THEMES: StudioTheme[] = [
  { id: "aniversario", title: "Aniversário", description: "Bolo, balões e clima de festa." },
  { id: "halloween", title: "Halloween divertido", description: "Abóboras e fantasias leves, sem sustos." },
  { id: "natal", title: "Natal acolhedor", description: "Luzes quentes, manta e enfeites." },
];
