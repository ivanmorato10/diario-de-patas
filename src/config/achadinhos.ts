/**
 * Achadinhos do Abu: produtos escolhidos pelo proprietário (links de afiliado da Amazon).
 * Regras: sem preço fixo (a Amazon proíbe preço copiado), sem imagem copiada da Amazon (só ilustração
 * ou foto própria do Abu em `photo`), aviso de associado visível, links rel="sponsored".
 * Nada de remédio; comida e petisco sem promessa de saúde.
 */
export type AchadinhoCategory = "brincar" | "passeio" | "soneca" | "banho" | "comer";

/** ID de associado da Amazon (EUA) dos links enviados pelo proprietário. */
export const AMAZON_TAG = "biancaassunca-20";

export interface Achadinho {
  id: string;
  name: string;
  category: AchadinhoCategory;
  /** Comentário curto na voz do Abu (sem promessas de saúde). */
  abuSays: string;
  /** Código do produto na Amazon: gera o link direto e a imagem oficial. */
  asin: string;
  store: string;
  /** Foto própria (public/achadinhos/…), opcional. Sem ela, mostra a ilustração da categoria. */
  photo?: string;
}

export const ACHADINHO_CATEGORIES: { id: AchadinhoCategory; label: string; emoji: string; bg: string }[] = [
  { id: "brincar", label: "Brincar", emoji: "🎾", bg: "#ffe3d1" },
  { id: "passeio", label: "Passeio", emoji: "🦮", bg: "#d6efea" },
  { id: "soneca", label: "Soneca", emoji: "😴", bg: "#e9def3" },
  { id: "banho", label: "Banho e cuidados", emoji: "🛁", bg: "#dbeefc" },
  { id: "comer", label: "Petiscos e comida", emoji: "🦴", bg: "#fff1c9" },
];

export const AFFILIATE_DISCLOSURE = "Como associado da Amazon, ganhamos com compras qualificadas, sem mudar o seu preço.";

export const ACHADINHOS: Achadinho[] = [
  { id: "chuckit-launcher", name: "Lançador de bolinha Chuckit! Sport", category: "brincar", abuSays: "Joga mais longe e você nem precisa pegar a bolinha babada. Eu aprovo! 🐾", asin: "B000PKWKMQ", store: "Amazon (EUA)" },
  { id: "lancador-automatico", name: "Lançador automático de bolinha ALL FOR PAWS", category: "brincar", abuSays: "Para os dias em que meu humano está ocupado: eu mesmo coloco a bolinha e ele lança.", asin: "B07PYPGL27", store: "Amazon (EUA)" },
  { id: "petisco-wings", name: "Petisco de longa duração Good 'n' Fun Wings", category: "comer", abuSays: "Rende uma tarde inteira de roer. Petisco é agrado, não refeição!", asin: "B01HXYUUXC", store: "Amazon (EUA)" },
  { id: "honest-kitchen", name: "Comida natural The Honest Kitchen (cordeiro)", category: "comer", abuSays: "Cheirinho de comida de verdade. Troca de alimentação, sempre com o veterinário, viu?", asin: "B0HFX1WMVF", store: "Amazon (EUA)" },
];

/** Link direto do produto com o ID de associado (sem os redirecionamentos do link curto, que travam no app instalado). */
export const amazonUrl = (a: Achadinho) => `https://www.amazon.com/dp/${a.asin}?tag=${AMAZON_TAG}`;

