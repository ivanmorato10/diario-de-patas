/**
 * Seeds versionados do catálogo (briefing §9, §11, §12, §21).
 * Fonte única para UI, domínio e para o seed SQL (supabase/seed.sql deve espelhar este arquivo).
 */
export const CATALOG_VERSION = 2;

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
  title: string;
  description: string;
  /** Datas especiais abriga só as artes do Estúdio; não tem missões (MUDANCAS-V2 §3). */
  hasMissions: boolean;
}

export const COLLECTIONS: Collection[] = [
  { id: "primeiras-lembrancas", title: "Primeiras lembranças", description: "O começo do diário.", hasMissions: true },
  { id: "vida-em-casa", title: "Vida em casa", description: "Sonecas, brinquedos e cantinhos.", hasMissions: true },
  { id: "nosso-vinculo", title: "Nosso vínculo", description: "Momentos de companhia.", hasMissions: true },
  { id: "pequenas-aventuras", title: "Pequenas aventuras", description: "Passeios e descobertas lá fora.", hasMissions: true },
  { id: "manias-e-expressoes", title: "Manias e expressões", description: "Caras, jeitos e retratos.", hasMissions: true },
  { id: "estacoes-e-datas", title: "Estações e datas", description: "Chuva, frio, calor e datas que vocês comemoram.", hasMissions: true },
  { id: "cuidados", title: "Cuidados", description: "Banho, tosa, veterinário e outros cuidados.", hasMissions: true },
  { id: "datas-especiais", title: "Datas especiais", description: "Artes comemorativas do estúdio.", hasMissions: false },
];

/** Contexto usado para respeitar preferências (§9: sociais só se permitido; externas têm alternativas internas). */
export type MissionContext = "home" | "outdoor" | "social-dogs" | "people" | "any";

export interface MissionTemplate {
  id: string; // M01..M48
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
  /** Missão de data especial: opcional, nunca é pré-requisito de nada (MUDANCAS-V2 §3). */
  optional?: boolean;
  /** Missões externas sempre têm uma alternativa em casa (§9, MUDANCAS-V2 §3). */
  homeAlternative?: string;
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
  { ...base, id: "M07", slug: "explorador-do-parque", title: "Explorador do parque", description: "Um passeio com grama, árvores ou jardim por perto.", criterion: "Cachorro em ambiente externo com cara de parque ou jardim.", xp: 20, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: "Sem parque? Um vaso de plantas, o quintal ou a varanda também viram jardim." },
  { ...base, id: "M08", slug: "pe-na-rua", title: "Pé na rua", description: "Qualquer passeio vale — perto ou longe.", criterion: "Cachorro em um passeio ao ar livre.", xp: 15, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: "Sem passeio hoje? Uma volta pelo quintal, pela varanda ou pelo corredor também vale." },
  { ...base, id: "M09", slug: "amizade-de-patas", title: "Amizade de patas", description: "Quando aparece mais alguém de quatro patas.", criterion: "Dois ou mais cachorros enquadrados. Não precisam estar encostados.", xp: 20, collectionId: "pequenas-aventuras", context: "social-dogs", prerequisiteId: "M01" },
  { ...base, id: "M10", slug: "momento-engracado", title: "Momento engraçado", description: "Você decide o que é engraçado. A gente só guarda.", criterion: "Cachorro na foto. O humor é seu — não é avaliado.", xp: 10, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01", subjective: true },
  { ...base, id: "M11", slug: "companhia-tranquila", title: "Companhia tranquila", description: "Um descanso lado a lado.", criterion: "Cachorro descansando perto de uma pessoa.", xp: 15, collectionId: "nosso-vinculo", context: "people", prerequisiteId: "M01" },
  { ...base, id: "M12", slug: "cara-de-capa", title: "Cara de capa", description: "Um retrato digno da capa do álbum.", criterion: "Retrato com o cachorro claramente visível.", xp: 10, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01" },
  // MUDANCAS-V2 §3 — pré-requisito M01, fotos antigas valem.
  { ...base, id: "M13", slug: "primeiro-dia-em-casa", title: "Primeiro dia em casa", description: "Uma foto do começo de vocês. Vale foto antiga — quanto mais antiga, melhor.", criterion: "Uma foto do começo de vocês dois (pode ser antiga).", xp: 15, collectionId: "primeiras-lembrancas", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M14", slug: "patinha-de-perto", title: "Patinha de perto", description: "Um close daquela patinha.", criterion: "A patinha em close.", xp: 10, collectionId: "primeiras-lembrancas", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M15", slug: "meu-nome", title: "Meu nome", description: "A coleira ou a plaquinha com o nome.", criterion: "A coleira ou a plaquinha com o nome aparecendo.", xp: 10, collectionId: "primeiras-lembrancas", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M16", slug: "bocejo-flagrado", title: "Bocejo flagrado", description: "Pegou no flagra aquele bocejo enorme?", criterion: "O cachorro bocejando.", xp: 15, collectionId: "manias-e-expressoes", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M17", slug: "posicao-estranha-de-dormir", title: "Posição estranha de dormir", description: "Aquela pose impossível na hora de dormir.", criterion: "O cachorro dormindo numa posição curiosa.", xp: 15, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M18", slug: "esperando-na-porta", title: "Esperando na porta", description: "De olho na porta, esperando alguém chegar.", criterion: "O cachorro perto da porta, esperando.", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M19", slug: "hora-do-banho", title: "Hora do banho", description: "Durante ou logo depois do banho — pelo molhado vale.", criterion: "O cachorro no banho ou logo depois.", xp: 15, collectionId: "cuidados", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M20", slug: "cheiroso", title: "Cheiroso", description: "Depois do banho ou da tosa, todo arrumado.", criterion: "O cachorro depois do banho ou da tosa.", xp: 10, collectionId: "cuidados", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M21", slug: "dia-de-chuva", title: "Dia de chuva", description: "Olhando a chuva pela janela ou secando no tapete.", criterion: "O cachorro num dia de chuva, dentro de casa.", xp: 10, collectionId: "estacoes-e-datas", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M22", slug: "esconderijo-favorito", title: "Esconderijo favorito", description: "Aquele lugar secreto preferido.", criterion: "O cachorro no seu esconderijo preferido.", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M23", slug: "dono-do-sofa", title: "Dono do sofá", description: "Ocupando o sofá ou a cama como se fosse o dono. E é.", criterion: "O cachorro deitado no sofá ou na cama.", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M24", slug: "selfie-juntos", title: "Selfie juntos", description: "Você e seu cachorro numa selfie.", criterion: "Você e o cachorro na mesma selfie. Ninguém é identificado.", xp: 15, collectionId: "nosso-vinculo", context: "people", prerequisiteId: "M01" },
  { ...base, id: "M25", slug: "patinha-na-mao", title: "Patinha na mão", description: "A patinha na sua mão.", criterion: "A patinha do cachorro na mão de uma pessoa.", xp: 15, collectionId: "nosso-vinculo", context: "people", prerequisiteId: "M01" },
  { ...base, id: "M26", slug: "colo-bom", title: "Colo bom", description: "No colo de alguém, do jeitinho que gosta.", criterion: "O cachorro no colo de uma pessoa.", xp: 10, collectionId: "nosso-vinculo", context: "people", prerequisiteId: "M01" },
  { ...base, id: "M27", slug: "familia-reunida", title: "Família reunida", description: "O cachorro junto com a família.", criterion: "O cachorro com duas ou mais pessoas da família.", xp: 20, collectionId: "nosso-vinculo", context: "people", prerequisiteId: "M01" },
  { ...base, id: "M28", slug: "bom-dia", title: "Bom dia", description: "A primeira foto do dia.", criterion: "O cachorro logo pela manhã.", xp: 10, collectionId: "nosso-vinculo", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M29", slug: "boa-noite", title: "Boa noite", description: "Pronto para dormir.", criterion: "O cachorro na hora de dormir.", xp: 10, collectionId: "nosso-vinculo", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M30", slug: "cabeca-inclinada", title: "Cabeça inclinada", description: "A famosa cabecinha de lado.", criterion: "O cachorro com a cabeça inclinada.", xp: 15, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M31", slug: "lingua-de-fora", title: "Língua de fora", description: "A linguinha aparecendo.", criterion: "O cachorro com a língua de fora.", xp: 10, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M32", slug: "orelhas-em-acao", title: "Orelhas em ação", description: "Orelhas em pé, viradas ou voando.", criterion: "As orelhas do cachorro em destaque.", xp: 10, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M33", slug: "cara-de-culpado", title: "Cara de culpado", description: "Aquela cara depois de aprontar.", criterion: "O cachorro com cara de quem aprontou. A cara é você quem julga.", xp: 15, collectionId: "manias-e-expressoes", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M34", slug: "truque-favorito", title: "Truque favorito", description: "Fazendo um truque que já sabe — sem forçar nada.", criterion: "O cachorro fazendo um truque que já conhece.", xp: 20, collectionId: "manias-e-expressoes", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M35", slug: "brinquedo-sobrevivente", title: "Brinquedo sobrevivente", description: "O brinquedo mais destruído de todos, e ainda amado.", criterion: "O cachorro com um brinquedo bem gasto.", xp: 10, collectionId: "vida-em-casa", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M36", slug: "correria", title: "Correria!", description: "Correndo — foto tremida vale.", criterion: "O cachorro correndo (pode estar tremida).", xp: 15, collectionId: "pequenas-aventuras", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M37", slug: "novo-caminho", title: "Novo caminho", description: "Um passeio por um lugar novo.", criterion: "O cachorro passeando num lugar novo.", xp: 20, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: "Sem passeio? Um cantinho da casa pouco explorado também é um lugar novo." },
  { ...base, id: "M38", slug: "por-do-sol", title: "Pôr do sol", description: "Um passeio no fim da tarde.", criterion: "O cachorro num passeio no fim da tarde.", xp: 15, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: "Sem passeio? A luz do fim da tarde entrando pela janela também vale." },
  { ...base, id: "M39", slug: "pegadas", title: "Pegadas", description: "Pegadas na areia, na terra ou na neve.", criterion: "Pegadas do cachorro na areia, terra ou neve.", xp: 15, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: "Sem passeio? Pegadas no tapete depois do banho também contam." },
  { ...base, id: "M40", slug: "lugar-pet-friendly", title: "Lugar pet friendly", description: "Num café, loja ou parque que recebe pets.", criterion: "O cachorro num lugar que aceita pets.", xp: 20, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: "Sem sair? A casa de alguém que recebe vocês dois também é pet friendly." },
  { ...base, id: "M41", slug: "na-estrada", title: "Na estrada", description: "Passeio de carro com segurança: cinto pet ou caixa de transporte.", criterion: "O cachorro no carro, com cinto pet ou na caixa de transporte.", xp: 15, collectionId: "pequenas-aventuras", context: "outdoor", prerequisiteId: "M01", homeAlternative: "Sem carro? A caixa de transporte arrumada para um passeio também vale." },
  { ...base, id: "M42", slug: "dia-de-praia", title: "Dia de praia", description: "Na praia ou na beira d’água. Opcional — só se fizer parte da vida de vocês.", criterion: "O cachorro na praia ou perto da água.", xp: 20, collectionId: "estacoes-e-datas", context: "outdoor", prerequisiteId: "M01", optional: true, homeAlternative: "Sem praia? Uma brincadeira com água em casa, se o seu cachorro gostar, também vale." },
  { ...base, id: "M43", slug: "dia-de-frio", title: "Dia de frio", description: "De roupinha confortável ou enrolado na manta.", criterion: "O cachorro aquecido num dia frio.", xp: 10, collectionId: "estacoes-e-datas", context: "home", prerequisiteId: "M01" },
  { ...base, id: "M44", slug: "dia-de-calor", title: "Dia de calor", description: "Na sombra, com água fresca por perto.", criterion: "O cachorro na sombra ou perto da água fresca.", xp: 10, collectionId: "estacoes-e-datas", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M45", slug: "feliz-aniversario", title: "Feliz aniversário", description: "Comemorando o aniversário. Opcional — se vocês comemoram.", criterion: "O cachorro numa comemoração de aniversário.", xp: 20, collectionId: "estacoes-e-datas", context: "any", prerequisiteId: "M01", optional: true },
  { ...base, id: "M46", slug: "natal-juntos", title: "Natal juntos", description: "Clima de Natal em casa. Opcional.", criterion: "O cachorro com enfeites ou clima de Natal por perto.", xp: 15, collectionId: "estacoes-e-datas", context: "home", prerequisiteId: "M01", optional: true },
  { ...base, id: "M47", slug: "visita-ao-veterinario", title: "Visita ao veterinário", description: "Na consulta ou na sala de espera.", criterion: "O cachorro numa clínica veterinária.", xp: 15, collectionId: "cuidados", context: "any", prerequisiteId: "M01" },
  { ...base, id: "M48", slug: "unhas-e-tosa", title: "Unhas e tosa", description: "Dia de cuidar das unhas ou dos pelos.", criterion: "O cachorro num dia de cuidado com unhas ou pelos.", xp: 10, collectionId: "cuidados", context: "any", prerequisiteId: "M01" },
];

export interface Level {
  minXp: number;
  title: string;
}

/** Catálogo de 48 missões = 650 XP; o maior nível (500) é alcançável — há um teste para isso (MUDANCAS-V2 §3). */
export const LEVELS: Level[] = [
  { minXp: 0, title: "Novo companheiro" },
  { minXp: 30, title: "Colecionador de momentos" },
  { minXp: 70, title: "Explorador" },
  { minXp: 120, title: "Guardião de lembranças" },
  { minXp: 220, title: "Contador de histórias" },
  { minXp: 350, title: "Melhores amigos" },
  { minXp: 500, title: "Sempre juntos" },
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
