/**
 * Achadinhos do Abu: produtos escolhidos pelo proprietário (links de afiliado da Amazon).
 * Regras: sem preço fixo (a Amazon proíbe preço copiado), sem imagem copiada da Amazon (só ilustração
 * ou foto própria do Abu em `photo`), aviso de associado visível, links rel="sponsored".
 * Nada de remédio; comida e petisco sem promessa de saúde.
 */
export type AchadinhoCategory = "brincar" | "passeio" | "soneca" | "banho" | "comer";

/** ID de associado da Amazon (EUA) dos links enviados pelo proprietário. */
export const AMAZON_TAG = "biancaassunca-20";

/** Nome e comentário do Abu (sem promessas de saúde): finds.items.<id>.name / .abuSays nos arquivos de idioma. */
export interface Achadinho {
  id: string;
  category: AchadinhoCategory;
  /** Código do produto na Amazon: gera o link direto e a imagem oficial. */
  asin: string;
  store: string;
  /** Foto própria (public/achadinhos/…), opcional. Sem ela, mostra a ilustração da categoria. */
  photo?: string;
}

/** Nome de cada categoria em finds.categories.<id>. */
export const ACHADINHO_CATEGORIES: { id: AchadinhoCategory; emoji: string; bg: string }[] = [
  { id: "brincar", emoji: "🎾", bg: "#ffe3d1" },
  { id: "passeio", emoji: "🦮", bg: "#d6efea" },
  { id: "soneca", emoji: "😴", bg: "#e9def3" },
  { id: "banho", emoji: "🛁", bg: "#dbeefc" },
  { id: "comer", emoji: "🦴", bg: "#fff1c9" },
];

export const ACHADINHOS: Achadinho[] = [
  { id: "chuckit-launcher", category: "brincar", asin: "B000PKWKMQ", store: "Amazon" },
  { id: "lancador-automatico", category: "brincar", asin: "B07PYPGL27", store: "Amazon" },
  { id: "petisco-wings", category: "comer", asin: "B01HXYUUXC", store: "Amazon" },
  { id: "honest-kitchen", category: "comer", asin: "B0HFX1WMVF", store: "Amazon" },
];

/** Link direto do produto com o ID de associado (sem os redirecionamentos do link curto, que travam no app instalado). */
export const amazonUrl = (a: Achadinho) => `https://www.amazon.com/dp/${a.asin}?tag=${AMAZON_TAG}`;

