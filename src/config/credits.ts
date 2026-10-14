/** Pacotes de créditos do Estúdio (preços aprovados pelo proprietário em 13/10/2026). 1 crédito = 1 arte normal. */
export interface CreditPackage {
  id: string;
  credits: number;
  priceCents: number;
  badge?: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "p5", credits: 5, priceCents: 490 },
  { id: "p15", credits: 15, priceCents: 790 },
  { id: "p40", credits: 40, priceCents: 1990, badge: "Melhor preço" },
];

export const packageById = (id: string) => CREDIT_PACKAGES.find((p) => p.id === id);

export const formatBRL = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Preço por crédito, para mostrar "R$ 0,53 por arte". */
export const perCredit = (p: CreditPackage) => formatBRL(Math.round(p.priceCents / p.credits));

/** Validade do Pix gerado (minutos). */
export const PIX_EXPIRES_MINUTES = 30;

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
