/**
 * Ciclo contínuo de missões (MUDANCAS-V2 §7): missões do dia, coleções permanentes e especiais.
 * As 48 missões de `catalog.ts` continuam como missões únicas (`kind: "once"`).
 */
import type { MissionTemplate } from "./catalog";

export type DailySlot = "A" | "B" | "C";

export const DAILY_SLOTS: { id: DailySlot; title: string }[] = [
  { id: "A", title: "Casa e descanso" },
  { id: "B", title: "Companhia e brincadeira" },
  { id: "C", title: "Passeio ou retrato" },
];

/** Pontos por tipo (§7). */
export const CYCLE_XP = { daily: 10, collectionItem: 15, collectionMedal: 50, special: 20 } as const;
/** Missão do dia não volta se foi sugerida ou concluída nesta janela — enquanto houver opção no espaço. */
export const DAILY_NO_REPEAT_DAYS = 14;

const d = { acceptsGallery: true, version: 1, subjective: false, prerequisiteId: "M01", kind: "daily" as const, xp: CYCLE_XP.daily };

/** Banco inicial de 36 missões do dia (§7.4). `portrait` = serve para quem não passeia (†). */
export const DAILY_MISSIONS: MissionTemplate[] = [
  // Espaço A — casa e descanso
  { ...d, slot: "A", id: "D01", slug: "dia-meu-cantinho-favorito", title: "Meu cantinho favorito", description: "O lugar da casa que foi o escolhido de hoje.", criterion: "O cachorro no cantinho preferido.", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D02", slug: "dia-soneca-da-tarde", title: "Soneca da tarde", description: "Aquele cochilo depois do almoço.", criterion: "O cachorro cochilando.", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D03", slug: "dia-esperando-o-petisco", title: "Esperando o petisco de sempre", description: "A espera pelo petisco de todo dia — nada extra para a foto.", criterion: "O cachorro esperando o petisco habitual.", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D04", slug: "dia-na-janela", title: "Na janela", description: "De olho no movimento lá fora.", criterion: "O cachorro olhando pela janela.", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D05", slug: "dia-depois-da-aventura", title: "Depois da aventura, descanso", description: "Recarregando as energias.", criterion: "O cachorro descansando depois de brincar ou passear.", collectionId: "vida-em-casa", context: "home", advancesItem: "C09" },
  { ...d, slot: "A", id: "D06", slug: "dia-espreguicada", title: "Espreguiçada", description: "Aquela esticada caprichada.", criterion: "O cachorro se espreguiçando.", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D07", slug: "dia-no-tapete", title: "No tapete", description: "Esparramado no tapete de casa.", criterion: "O cachorro no tapete.", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D08", slug: "dia-hora-da-refeicao", title: "Hora da refeição de sempre", description: "A refeição de todo dia, sem nada extra para a foto.", criterion: "O cachorro junto ao pote da refeição habitual.", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D09", slug: "dia-bagunca-do-dia", title: "Bagunça do dia", description: "A arte de hoje — sem bronca, só registro.", criterion: "O cachorro perto de uma bagunça.", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D10", slug: "dia-cochilo-no-sol", title: "Cochilo no sol", description: "Aquela faixa de sol no chão.", criterion: "O cachorro deitado no sol.", collectionId: "vida-em-casa", context: "home" },
  { ...d, slot: "A", id: "D11", slug: "dia-olhar-ja-acabou", title: "Olhar de “já acabou?”", description: "Aquela cara de quem queria mais um pouco.", criterion: "O cachorro olhando para a câmera.", collectionId: "manias-e-expressoes", context: "home", advancesItem: "C06" },
  { ...d, slot: "A", id: "D12", slug: "dia-foto-do-dia-em-casa", title: "Foto do dia em casa", description: "Qualquer momento de hoje em casa vale.", criterion: "O cachorro em casa.", collectionId: "vida-em-casa", context: "home" },
  // Espaço B — companhia e brincadeira
  { ...d, slot: "B", id: "D13", slug: "dia-brinquedo-inseparavel", title: "Brinquedo inseparável", description: "O brinquedo que vai para todo canto.", criterion: "O cachorro com um brinquedo.", collectionId: "vida-em-casa", context: "home", advancesItem: "M03" },
  { ...d, slot: "B", id: "D14", slug: "dia-companhia-no-sofa", title: "Companhia no sofá", description: "Dividindo o sofá com alguém.", criterion: "O cachorro no sofá junto de uma pessoa.", collectionId: "nosso-vinculo", context: "people", advancesItem: "C10" },
  { ...d, slot: "B", id: "D15", slug: "dia-foto-com-meu-humano", title: "Foto com meu humano", description: "Você e seu cachorro, do jeito que der.", criterion: "O cachorro com uma pessoa.", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D16", slug: "dia-cabo-de-guerra", title: "Cabo de guerra", description: "Uma rodada de puxa-puxa.", criterion: "O cachorro puxando um brinquedo.", collectionId: "vida-em-casa", context: "any", advancesItem: "C13" },
  { ...d, slot: "B", id: "D17", slug: "dia-buscando-a-bolinha", title: "Buscando a bolinha", description: "Vai, pega, traz — de novo.", criterion: "O cachorro com uma bolinha.", collectionId: "vida-em-casa", context: "any", advancesItem: "C12" },
  { ...d, slot: "B", id: "D18", slug: "dia-carinho-na-barriga", title: "Carinho na barriga", description: "A barriga para cima pedindo carinho.", criterion: "Uma pessoa fazendo carinho no cachorro.", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D19", slug: "dia-treino-de-um-truque", title: "Treino de um truque", description: "Um treino rápido, no ritmo do seu cachorro.", criterion: "O cachorro treinando um truque.", collectionId: "manias-e-expressoes", context: "any" },
  { ...d, slot: "B", id: "D20", slug: "dia-brincando-com-a-familia", title: "Brincando com alguém da família", description: "Uma brincadeira em família.", criterion: "O cachorro brincando com uma pessoa.", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D21", slug: "dia-juntinhos", title: "Juntinhos", description: "Bem pertinho de alguém.", criterion: "O cachorro encostado em uma pessoa.", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D22", slug: "dia-recebendo-alguem", title: "Recebendo alguém em casa", description: "A festa de quando alguém chega.", criterion: "O cachorro recebendo uma pessoa.", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D23", slug: "dia-momento-de-carinho", title: "Momento de carinho", description: "Um carinho qualquer, do jeito de vocês.", criterion: "Uma pessoa fazendo carinho no cachorro.", collectionId: "nosso-vinculo", context: "people" },
  { ...d, slot: "B", id: "D24", slug: "dia-brincadeira-inventada", title: "Brincadeira inventada", description: "Aquela brincadeira que só vocês conhecem.", criterion: "O cachorro brincando.", collectionId: "manias-e-expressoes", context: "any" },
  // Espaço C — passeio ou retrato († = retrato, para quem não passeia)
  { ...d, slot: "C", id: "D25", slug: "dia-passeio-do-dia", title: "Passeio do dia", description: "O passeio de hoje, curto ou longo.", criterion: "O cachorro passeando.", collectionId: "pequenas-aventuras", context: "outdoor" },
  { ...d, slot: "C", id: "D26", slug: "dia-explorando-um-cheiro", title: "Explorando um cheiro", description: "Aquela farejada que não tem pressa.", criterion: "O cachorro farejando lá fora.", collectionId: "pequenas-aventuras", context: "outdoor" },
  { ...d, slot: "C", id: "D27", slug: "dia-retrato-de-pertinho", title: "Retrato de pertinho", description: "Um retrato bem de perto.", criterion: "Retrato próximo do cachorro.", collectionId: "manias-e-expressoes", context: "any", portrait: true },
  { ...d, slot: "C", id: "D28", slug: "dia-perfil-elegante", title: "Perfil elegante", description: "De lado, pose de quadro.", criterion: "O cachorro de perfil.", collectionId: "manias-e-expressoes", context: "any", portrait: true },
  { ...d, slot: "C", id: "D29", slug: "dia-olhando-para-a-camera", title: "Olhando para a câmera", description: "Olho no olho.", criterion: "O cachorro olhando para a câmera.", collectionId: "manias-e-expressoes", context: "any", portrait: true },
  { ...d, slot: "C", id: "D30", slug: "dia-grama-ou-terra", title: "Grama ou terra", description: "Patas na grama ou na terra.", criterion: "O cachorro na grama ou na terra.", collectionId: "pequenas-aventuras", context: "outdoor", advancesItem: "C08" },
  { ...d, slot: "C", id: "D31", slug: "dia-encontro-na-rua", title: "Encontro na rua", description: "Um encontro tranquilo com outro cachorro.", criterion: "O cachorro perto de outro cachorro.", collectionId: "pequenas-aventuras", context: "social-dogs" },
  { ...d, slot: "C", id: "D32", slug: "dia-uma-pose-engracada", title: "Uma pose engraçada", description: "Você decide o que é engraçado.", criterion: "O cachorro na foto. O humor é seu.", collectionId: "manias-e-expressoes", context: "any", portrait: true, subjective: true },
  { ...d, slot: "C", id: "D33", slug: "dia-ceu-de-hoje", title: "Céu de hoje no passeio", description: "O céu de hoje aparecendo na foto.", criterion: "O cachorro lá fora com o céu aparecendo.", collectionId: "pequenas-aventuras", context: "outdoor" },
  { ...d, slot: "C", id: "D34", slug: "dia-de-volta-para-casa", title: "De volta para casa", description: "A chegada depois do passeio.", criterion: "O cachorro voltando para casa.", collectionId: "pequenas-aventuras", context: "outdoor", advancesItem: "C09" },
  { ...d, slot: "C", id: "D35", slug: "dia-retrato-com-luz-bonita", title: "Retrato com luz bonita", description: "Aproveite uma luz bonita de hoje.", criterion: "Retrato do cachorro.", collectionId: "manias-e-expressoes", context: "any", portrait: true },
  { ...d, slot: "C", id: "D36", slug: "dia-close-no-focinho", title: "Close no focinho", description: "O focinho em primeiro plano.", criterion: "Close do focinho do cachorro.", collectionId: "manias-e-expressoes", context: "any", portrait: true },
];

const c = { acceptsGallery: true, version: 1, subjective: false, prerequisiteId: "M01", kind: "collection_item" as const, xp: CYCLE_XP.collectionItem };

/** Itens novos das coleções permanentes (os demais reaproveitam missões M existentes). */
export const COLLECTION_ITEMS: MissionTemplate[] = [
  { ...c, id: "C01", slug: "colecao-enroladinho", title: "Enroladinho", description: "Dormindo enrolado como uma rosquinha.", criterion: "O cachorro dormindo enrolado.", collectionId: "vida-em-casa", context: "home" },
  { ...c, id: "C02", slug: "colecao-barriga-pra-cima", title: "Barriga pra cima", description: "Dormindo de barriga para cima.", criterion: "O cachorro deitado de barriga para cima.", collectionId: "vida-em-casa", context: "home" },
  { ...c, id: "C03", slug: "colecao-esparramado", title: "Esparramado", description: "Ocupando todo o espaço possível.", criterion: "O cachorro deitado esparramado.", collectionId: "vida-em-casa", context: "home" },
  { ...c, id: "C04", slug: "colecao-focinho-na-patinha", title: "Focinho na patinha", description: "O focinho apoiado na patinha.", criterion: "O cachorro com o focinho sobre a pata.", collectionId: "vida-em-casa", context: "home" },
  { ...c, id: "C05", slug: "colecao-dormindo-com-o-brinquedo", title: "Dormindo com o brinquedo", description: "Abraçado ao brinquedo na hora de dormir.", criterion: "O cachorro dormindo perto de um brinquedo.", collectionId: "vida-em-casa", context: "home" },
  { ...c, id: "C06", slug: "colecao-olhar-pidao", title: "Olhar pidão", description: "Aquele olhar que pede tudo.", criterion: "O cachorro olhando para a câmera.", collectionId: "manias-e-expressoes", context: "any" },
  { ...c, id: "C07", slug: "colecao-passeio-de-manha", title: "Manhã", description: "Um passeio de manhã.", criterion: "O cachorro lá fora de manhã.", collectionId: "pequenas-aventuras", context: "outdoor", homeAlternative: "Sem passeio? A manhã no quintal, na varanda ou na janela também vale." },
  { ...c, id: "C08", slug: "colecao-grama-verdinha", title: "Grama verdinha", description: "Patas na grama.", criterion: "O cachorro na grama.", collectionId: "pequenas-aventuras", context: "outdoor", homeAlternative: "Sem passeio? Um vaso de plantas, o quintal ou a varanda também valem." },
  { ...c, id: "C09", slug: "colecao-voltando-cansado", title: "Voltando cansado", description: "O descanso depois do passeio.", criterion: "O cachorro descansando depois de passear ou brincar.", collectionId: "pequenas-aventuras", context: "any" },
  { ...c, id: "C10", slug: "colecao-sofa-juntos", title: "Sofá juntos", description: "Você e seu cachorro no sofá.", criterion: "O cachorro no sofá com uma pessoa.", collectionId: "nosso-vinculo", context: "people" },
  { ...c, id: "C11", slug: "colecao-a-mesma-pose", title: "A mesma pose", description: "Vocês dois fazendo a mesma pose.", criterion: "O cachorro e uma pessoa na mesma pose.", collectionId: "nosso-vinculo", context: "people", subjective: true },
  { ...c, id: "C12", slug: "colecao-bolinha", title: "Bolinha", description: "A bolinha preferida.", criterion: "O cachorro com uma bolinha.", collectionId: "vida-em-casa", context: "any" },
  { ...c, id: "C13", slug: "colecao-cabo-de-guerra", title: "Cabo de guerra", description: "Puxa daqui, puxa de lá.", criterion: "O cachorro puxando um brinquedo.", collectionId: "vida-em-casa", context: "any" },
  { ...c, id: "C14", slug: "colecao-esconderijo-de-brinquedos", title: "Esconderijo de brinquedos", description: "Onde os brinquedos vão parar.", criterion: "Brinquedos do cachorro escondidos ou guardados num canto.", collectionId: "vida-em-casa", context: "home" },
  { ...c, id: "C15", slug: "colecao-aquela-mania", title: "Aquela mania única", description: "A mania que ninguém mais tem.", criterion: "O cachorro na foto. A mania é você quem escolhe.", collectionId: "manias-e-expressoes", context: "any", subjective: true },
];

export type PermanentSetId = "poses-de-dormir" | "caras-e-expressoes" | "nossos-passeios" | "nos-dois" | "brinquedos-e-manias";

export interface PermanentSet {
  id: PermanentSetId;
  title: string;
  /** 6 itens; IDs M reaproveitam missões do catálogo (§7.5). */
  items: [string, string, string, string, string, string];
  note?: string;
}

export const PERMANENT_SETS: PermanentSet[] = [
  { id: "poses-de-dormir", title: "As poses de dormir", items: ["C01", "C02", "C03", "C04", "C05", "M17"] },
  { id: "caras-e-expressoes", title: "Caras e expressões", items: ["M30", "M31", "M33", "M32", "M16", "C06"] },
  { id: "nossos-passeios", title: "Nossos passeios", items: ["C07", "M38", "M37", "M39", "C08", "C09"], note: "Sem passeio? Quintal, varanda ou janela também valem." },
  { id: "nos-dois", title: "Nós dois", items: ["M24", "M25", "M26", "C10", "C11", "M27"] },
  { id: "brinquedos-e-manias", title: "Brinquedos e manias", items: ["M03", "M35", "C12", "C13", "C14", "C15"] },
];

const s = { acceptsGallery: true, version: 1, subjective: false, prerequisiteId: "M01", kind: "special" as const, xp: CYCLE_XP.special, collectionId: "estacoes-e-datas" as const, optional: true };

/** Missões especiais (§7.6). Janelas em `domain/cycle.ts`. O título do aniversário leva o nome do cachorro. */
export const SPECIAL_MISSIONS: MissionTemplate[] = [
  { ...s, id: "S01", slug: "especial-aniversario", title: "Aniversário", description: "A semana do aniversário chegou. Uma foto para lembrar deste ano.", criterion: "O cachorro no clima do aniversário.", context: "any", studioTheme: "aniversario" },
  { ...s, id: "S02", slug: "especial-natal", title: "Natal juntos", description: "Clima de Natal em casa.", criterion: "O cachorro com enfeites ou clima de Natal por perto.", context: "home", studioTheme: "natal" },
  { ...s, id: "S03", slug: "especial-halloween", title: "Halloween divertido", description: "Fantasia só se ficar confortável. Foto com abóbora ou decoração também vale.", criterion: "O cachorro com abóbora, decoração ou fantasia confortável.", context: "any", studioTheme: "halloween" },
];
