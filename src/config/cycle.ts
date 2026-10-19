/**
 * Ciclo contínuo de missões (MUDANCAS-V2 §7): missões do dia, coleções permanentes e especiais.
 * As 48 missões de `catalog.ts` continuam como missões únicas (`kind: "once"`).
 */
import type { MissionTemplate } from "./catalog";

export type DailySlot = "A" | "B" | "C";

/** Espaços do sorteio; nomes em catalog.slots.<id>. */
export const DAILY_SLOTS: { id: DailySlot }[] = [{ id: "A" }, { id: "B" }, { id: "C" }];

/** Pontos por tipo (§7). */
export const CYCLE_XP = { daily: 10, collectionItem: 15, collectionMedal: 50, special: 20 } as const;
/** Missão do dia não volta se foi sugerida ou concluída nesta janela — enquanto houver opção no espaço. */
export const DAILY_NO_REPEAT_DAYS = 14;

const d = { acceptsGallery: true, version: 1, subjective: false, prerequisiteId: "M01", kind: "daily" as const, xp: CYCLE_XP.daily };

/** Banco de 66 missões do dia (§7.4): 36 iniciais + 30 aprovadas em 13/10/2026, 22 por espaço. `portrait` = serve para quem não passeia (†). */
export const DAILY_MISSIONS: MissionTemplate[] = [
  // Espaço A — casa e descanso
  { ...d, slot: "A", id: "D01", slug: "dia-meu-cantinho-favorito", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D02", slug: "dia-soneca-da-tarde", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D03", slug: "dia-esperando-o-petisco", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D04", slug: "dia-na-janela", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D05", slug: "dia-depois-da-aventura", collectionId: "vida-em-casa", context: "home", advancesItem: "C09" },
  { ...d, slot: "A", id: "D06", slug: "dia-espreguicada", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D07", slug: "dia-no-tapete", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D08", slug: "dia-hora-da-refeicao", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D09", slug: "dia-bagunca-do-dia", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D10", slug: "dia-cochilo-no-sol", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D11", slug: "dia-olhar-ja-acabou", collectionId: "manias-e-expressoes", context: "home", advancesItem: "C06" },
  { ...d, slot: "A", id: "D12", slug: "dia-foto-do-dia-em-casa", collectionId: "vida-em-casa", context: "home" },
  // Novas (aprovadas pelo proprietário em 13/10/2026)
  { ...d, slot: "A", id: "D37", slug: "dia-patinhas-cruzadas", collectionId: "manias-e-expressoes", context: "home" },
  { ...d, slot: "A", id: "D38", slug: "dia-arrumando-a-cama", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D39", slug: "dia-de-guarda", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D40", slug: "dia-pezinho-de-fora", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D41", slug: "dia-fiscal-da-cozinha", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D42", slug: "dia-hora-da-agua", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D43", slug: "dia-debaixo-da-manta", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D44", slug: "dia-sombra-oficial", collectionId: "nosso-vinculo", context: "home" },
  { ...d, slot: "A", id: "D45", slug: "dia-sonhando-acordado", collectionId: "manias-e-expressoes", context: "home" },
  { ...d, slot: "A", id: "D46", slug: "dia-colega-de-trabalho", collectionId: "nosso-vinculo", context: "people" },
  // Espaço B — companhia e brincadeira
  { ...d, slot: "B", id: "D13", slug: "dia-brinquedo-inseparavel", collectionId: "vida-em-casa", context: "home", advancesItem: "M03" },
  { ...d, slot: "B", id: "D14", slug: "dia-companhia-no-sofa", collectionId: "nosso-vinculo", context: "people", advancesItem: "C10" },
  { ...d, slot: "B", id: "D15", slug: "dia-foto-com-meu-humano", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D16", slug: "dia-cabo-de-guerra", collectionId: "vida-em-casa", context: "any", advancesItem: "C13" },
  { ...d, slot: "B", id: "D17", slug: "dia-buscando-a-bolinha", collectionId: "vida-em-casa", context: "any", advancesItem: "C12" },
  { ...d, slot: "B", id: "D18", slug: "dia-carinho-na-barriga", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D19", slug: "dia-treino-de-um-truque", collectionId: "manias-e-expressoes", context: "any" },
  { ...d, slot: "B", id: "D20", slug: "dia-brincando-com-a-familia", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D21", slug: "dia-juntinhos", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D22", slug: "dia-recebendo-alguem", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D23", slug: "dia-momento-de-carinho", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D24", slug: "dia-brincadeira-inventada", collectionId: "manias-e-expressoes", context: "any" },
  // Novas (aprovadas pelo proprietário em 13/10/2026)
  { ...d, slot: "B", id: "D47", slug: "dia-esconde-esconde", collectionId: "manias-e-expressoes", context: "any" },
  { ...d, slot: "B", id: "D48", slug: "dia-brinquedo-redescoberto", collectionId: "vida-em-casa", context: "any" },
  { ...d, slot: "B", id: "D49", slug: "dia-pega-pega", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D50", slug: "dia-mordedor-da-vez", collectionId: "vida-em-casa", context: "any" },
  { ...d, slot: "B", id: "D51", slug: "dia-abraco-apertado", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D52", slug: "dia-caca-ao-petisco", collectionId: "manias-e-expressoes", context: "any" },
  { ...d, slot: "B", id: "D53", slug: "dia-atencao-total", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D54", slug: "dia-dupla-no-chao", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D55", slug: "dia-vem-pegar", collectionId: "manias-e-expressoes", context: "any" },
  { ...d, slot: "B", id: "D56", slug: "dia-escovinha", collectionId: "cuidados", context: "people" },
  // Espaço C — passeio ou retrato († = retrato, para quem não passeia)
  { ...d, slot: "C", id: "D25", slug: "dia-passeio-do-dia", collectionId: "pequenas-aventuras", context: "outdoor" },
  { ...d, slot: "C", id: "D26", slug: "dia-explorando-um-cheiro", collectionId: "pequenas-aventuras", context: "outdoor" },
  { ...d, slot: "C", id: "D27", slug: "dia-retrato-de-pertinho", collectionId: "manias-e-expressoes", context: "any", portrait: true },
  { ...d, slot: "C", id: "D28", slug: "dia-perfil-elegante", collectionId: "manias-e-expressoes", context: "any", portrait: true },
  { ...d, slot: "C", id: "D29", slug: "dia-olhando-para-a-camera", collectionId: "manias-e-expressoes", context: "any", portrait: true },
  { ...d, slot: "C", id: "D30", slug: "dia-grama-ou-terra", collectionId: "pequenas-aventuras", context: "outdoor", advancesItem: "C08" },
  { ...d, slot: "C", id: "D31", slug: "dia-encontro-na-rua", collectionId: "pequenas-aventuras", context: "social-dogs" },
  { ...d, slot: "C", id: "D32", slug: "dia-uma-pose-engracada", collectionId: "manias-e-expressoes", context: "any", portrait: true, subjective: true },
  { ...d, slot: "C", id: "D33", slug: "dia-ceu-de-hoje", collectionId: "pequenas-aventuras", context: "outdoor" },
  { ...d, slot: "C", id: "D34", slug: "dia-de-volta-para-casa", collectionId: "pequenas-aventuras", context: "outdoor", advancesItem: "C09" },
  { ...d, slot: "C", id: "D35", slug: "dia-retrato-com-luz-bonita", collectionId: "manias-e-expressoes", context: "any", portrait: true },
  { ...d, slot: "C", id: "D36", slug: "dia-close-no-focinho", collectionId: "manias-e-expressoes", context: "any", portrait: true },
  // Novas (aprovadas pelo proprietário em 13/10/2026)
  { ...d, slot: "C", id: "D57", slug: "dia-a-guia-apareceu", collectionId: "pequenas-aventuras", context: "any" },
  { ...d, slot: "C", id: "D58", slug: "dia-verde-no-caminho", collectionId: "pequenas-aventuras", context: "outdoor" },
  { ...d, slot: "C", id: "D59", slug: "dia-pausa-na-sombra", collectionId: "pequenas-aventuras", context: "outdoor" },
  { ...d, slot: "C", id: "D60", slug: "dia-pelo-ao-vento", collectionId: "pequenas-aventuras", context: "outdoor" },
  { ...d, slot: "C", id: "D61", slug: "dia-olhos-nos-olhos", collectionId: "manias-e-expressoes", context: "any", portrait: true },
  { ...d, slot: "C", id: "D62", slug: "dia-silhueta", collectionId: "manias-e-expressoes", context: "any", portrait: true },
  { ...d, slot: "C", id: "D63", slug: "dia-olhando-para-cima", collectionId: "manias-e-expressoes", context: "any", portrait: true },
  { ...d, slot: "C", id: "D64", slug: "dia-na-altura-dele", collectionId: "manias-e-expressoes", context: "any", portrait: true },
  { ...d, slot: "C", id: "D65", slug: "dia-banquinho-da-praca", collectionId: "pequenas-aventuras", context: "outdoor" },
  { ...d, slot: "C", id: "D66", slug: "dia-corpo-inteiro", collectionId: "manias-e-expressoes", context: "any", portrait: true },
];

const c = { acceptsGallery: true, version: 1, subjective: false, prerequisiteId: "M01", kind: "collection_item" as const, xp: CYCLE_XP.collectionItem };

/** Itens novos das coleções permanentes (os demais reaproveitam missões M existentes). */
export const COLLECTION_ITEMS: MissionTemplate[] = [
  { ...c, id: "C01", slug: "colecao-enroladinho", collectionId: "vida-em-casa", context: "home" },
  { ...c, id: "C02", slug: "colecao-barriga-pra-cima", collectionId: "vida-em-casa", context: "home" },
  { ...c, id: "C03", slug: "colecao-esparramado", collectionId: "vida-em-casa", context: "home" },
  { ...c, id: "C04", slug: "colecao-focinho-na-patinha", collectionId: "vida-em-casa", context: "home" },
  { ...c, id: "C05", slug: "colecao-dormindo-com-o-brinquedo", collectionId: "vida-em-casa", context: "home" },
  { ...c, id: "C06", slug: "colecao-olhar-pidao", collectionId: "manias-e-expressoes", context: "any" },
  { ...c, id: "C07", slug: "colecao-passeio-de-manha", collectionId: "pequenas-aventuras", context: "outdoor", homeAlternative: true },
  { ...c, id: "C08", slug: "colecao-grama-verdinha", collectionId: "pequenas-aventuras", context: "outdoor", homeAlternative: true },
  { ...c, id: "C09", slug: "colecao-voltando-cansado", collectionId: "pequenas-aventuras", context: "any" },
  { ...c, id: "C10", slug: "colecao-sofa-juntos", collectionId: "nosso-vinculo", context: "people" },
  { ...c, id: "C11", slug: "colecao-a-mesma-pose", collectionId: "nosso-vinculo", context: "people", subjective: true },
  { ...c, id: "C12", slug: "colecao-bolinha", collectionId: "vida-em-casa", context: "any" },
  { ...c, id: "C13", slug: "colecao-cabo-de-guerra", collectionId: "vida-em-casa", context: "any" },
  { ...c, id: "C14", slug: "colecao-esconderijo-de-brinquedos", collectionId: "vida-em-casa", context: "home" },
  { ...c, id: "C15", slug: "colecao-aquela-mania", collectionId: "manias-e-expressoes", context: "any", subjective: true },
];

export type PermanentSetId = "poses-de-dormir" | "caras-e-expressoes" | "nossos-passeios" | "nos-dois" | "brinquedos-e-manias";

export interface PermanentSet {
  id: PermanentSetId;
  /** 6 itens; IDs M reaproveitam missões do catálogo (§7.5). */
  items: [string, string, string, string, string, string];
  /** Tem observação (catalog.sets.<id>.note). */
  note?: boolean;
}

export const PERMANENT_SETS: PermanentSet[] = [
  { id: "poses-de-dormir", items: ["C01", "C02", "C03", "C04", "C05", "M17"] },
  { id: "caras-e-expressoes", items: ["M30", "M31", "M33", "M32", "M16", "C06"] },
  { id: "nossos-passeios", items: ["C07", "M38", "M37", "M39", "C08", "C09"], note: true },
  { id: "nos-dois", items: ["M24", "M25", "M26", "C10", "C11", "M27"] },
  { id: "brinquedos-e-manias", items: ["M03", "M35", "C12", "C13", "C14", "C15"] },
];

const s = { acceptsGallery: true, version: 1, subjective: false, prerequisiteId: "M01", kind: "special" as const, xp: CYCLE_XP.special, collectionId: "estacoes-e-datas" as const, optional: true };

/**
 * Missões especiais (§7.6). Janelas em `domain/cycle.ts`. O título do aniversário leva o nome do cachorro.
 * S04/S05: datas dos Estados Unidos (preferência de calendário "US"); no Brasil continuam as de sempre.
 */
export const SPECIAL_MISSIONS: MissionTemplate[] = [
  { ...s, id: "S01", slug: "especial-aniversario", context: "any", studioTheme: "aniversario" },
  { ...s, id: "S02", slug: "especial-natal", context: "home", studioTheme: "natal" },
  { ...s, id: "S03", slug: "especial-halloween", context: "any", studioTheme: "halloween" },
  { ...s, id: "S04", slug: "especial-national-dog-day", context: "any", studioTheme: "national-dog-day", region: "US" },
  { ...s, id: "S05", slug: "especial-thanksgiving", context: "home", studioTheme: "thanksgiving", region: "US" },
];
