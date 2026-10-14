/**
 * Achadinhos do Abu: produtos escolhidos pelo proprietário (links de afiliado da Amazon).
 * Regras: sem preço fixo (a Amazon proíbe preço copiado), sem imagem copiada da Amazon (só ilustração
 * ou foto própria do Abu em `photo`), aviso de associado visível, links rel="sponsored".
 * Nada de remédio; comida e petisco sem promessa de saúde.
 */
export type AchadinhoCategory = "brincar" | "passeio" | "soneca" | "banho" | "comer";

export interface Achadinho {
  id: string;
  name: string;
  category: AchadinhoCategory;
  /** Comentário curto na voz do Abu (sem promessas de saúde). */
  abuSays: string;
  url: string;
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

export const AFFILIATE_DISCLOSURE = "Como associado da Amazon, o Diário de Patas ganha com compras qualificadas. Isso não muda o preço para você.";

export const ACHADINHOS: Achadinho[] = [
  { id: "chuckit-launcher", name: "Lançador de bolinha Chuckit! Sport", category: "brincar", abuSays: "Joga mais longe e você nem precisa pegar a bolinha babada. Eu aprovo! 🐾", url: "https://link.amazon/B066TeMFF", store: "Amazon (EUA)" },
  { id: "lancador-automatico", name: "Lançador automático de bolinha ALL FOR PAWS", category: "brincar", abuSays: "Para os dias em que meu humano está ocupado: eu mesmo coloco a bolinha e ele lança.", url: "https://link.amazon/B05f63xJ1", store: "Amazon (EUA)" },
  { id: "petisco-wings", name: "Petisco de longa duração Good 'n' Fun Wings", category: "comer", abuSays: "Rende uma tarde inteira de roer. Petisco é agrado, não refeição!", url: "https://link.amazon/B0iN36xmv", store: "Amazon (EUA)" },
  { id: "honest-kitchen", name: "Comida natural The Honest Kitchen (cordeiro)", category: "comer", abuSays: "Cheirinho de comida de verdade. Troca de alimentação, sempre com o veterinário, viu?", url: "https://link.amazon/B07apPCGX", store: "Amazon (EUA)" },
];
