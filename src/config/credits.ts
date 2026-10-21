/** Pacotes de créditos do Estúdio (revistos pelo proprietário em 18/10/2026: 1 por R$ 1, 5 por R$ 4, 10 por R$ 7). 1 crédito = 1 arte normal. */
export interface CreditPackage {
  id: string;
  credits: number;
  priceCents: number;
  /** Selo do pacote (texto em credits.badges.<chave>). */
  badge?: "best";
}

/**
 * Preços FIXOS por mercado (nunca conversão de moeda). O mercado da cobrança é decidido no servidor pela região do
 * app (não pelo idioma): em inglês, quem está na região Brasil continua vendo reais (com "BRL" explícito).
 * Estados Unidos: dólar pelo Stripe Checkout (cartão, Apple Pay, Google Pay), preços aprovados pelo proprietário em
 * 21/10/2026: 1 por US$ 0,99, 5 por US$ 2,99, 10 por US$ 4,99 (docs/PAGAMENTOS-EUA.md).
 */
export type Market = "BR" | "US";
export interface CreditMarket { currency: "BRL" | "USD"; provider: "mercadopago" | "stripe" | null; packages: CreditPackage[] }
export const CREDIT_MARKETS: Record<Market, CreditMarket> = {
  BR: {
    currency: "BRL", provider: "mercadopago",
    packages: [
      { id: "p1", credits: 1, priceCents: 100 },
      { id: "p5", credits: 5, priceCents: 400 },
      { id: "p10", credits: 10, priceCents: 700, badge: "best" },
    ],
  },
  US: {
    currency: "USD", provider: "stripe",
    packages: [
      { id: "p1", credits: 1, priceCents: 99 },
      { id: "p5", credits: 5, priceCents: 299 },
      { id: "p10", credits: 10, priceCents: 499, badge: "best" },
    ],
  },
};
/**
 * O mercado da compra segue a REGIÃO DO APP da pessoa (Brasil → reais por Pix; EUA → dólar por cartão), nunca o idioma.
 * Com o Stripe desligado (STRIPE_ENABLED), a loja da região EUA aparece como "em breve".
 */
export const marketForRegion = (region: "BR" | "US"): Market => region;

export const CREDIT_PACKAGES: CreditPackage[] = CREDIT_MARKETS.BR.packages;

/** Pacote válido NO mercado da cobrança (o servidor nunca aceita preço ou moeda vindos do navegador). */
export const packageById = (id: string, market: Market = "BR") => CREDIT_MARKETS[market].packages.find((p) => p.id === id);

/**
 * App da App Store (iPhone): os créditos são comprados pela própria Apple (compra dentro do app), com os mesmos
 * pacotes. O preço de cada país é o da faixa escolhida no App Store Connect (a Apple mostra e cobra), não o daqui.
 */
export const APPLE_PRODUCTS: Record<string, string> = {
  p1: "diariodepatas.credits.1",
  p5: "diariodepatas.credits.5",
  p10: "diariodepatas.credits.10",
};
/** Pacote de um produto da Apple (o servidor só aceita estes). */
export const packageForAppleProduct = (productId: string) => {
  const id = Object.keys(APPLE_PRODUCTS).find((k) => APPLE_PRODUCTS[k] === productId);
  return id ? CREDIT_MARKETS.US.packages.find((p) => p.id === id) : undefined;
};

/** Validade do Pix gerado (minutos). */
export const PIX_EXPIRES_MINUTES = 30;
/** Validade da página de pagamento do Stripe (minutos; o Stripe exige no mínimo 30). */
export const CHECKOUT_EXPIRES_MINUTES = 31;

/** Arte do mês: ao somar XP_MONTH_GOAL de XP no mês (fuso XP_TIMEZONE), 1 crédito — no máximo 1 por mês. */
export const XP_MONTH_GOAL = 200;
export const XP_TIMEZONE = "America/Sao_Paulo";
/** Compatibilidade com o nome antigo. */
export const XP_PER_CREDIT = XP_MONTH_GOAL;

/** Mês civil (AAAA-MM) de um instante no fuso fixo do XP. */
export const xpMonthOf = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: XP_TIMEZONE, year: "numeric", month: "2-digit" }).format(new Date(d)).slice(0, 7);

export const monthReward = (xpMonth: number) => {
  const reached = xpMonth >= XP_MONTH_GOAL;
  return { reached, missing: Math.max(0, XP_MONTH_GOAL - xpMonth), pct: Math.min(100, Math.round((xpMonth / XP_MONTH_GOAL) * 100)) };
};
