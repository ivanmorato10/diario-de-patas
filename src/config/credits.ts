/** Pacotes de créditos do Estúdio (preços aprovados pelo proprietário em 13/10/2026). 1 crédito = 1 arte normal. */
export interface CreditPackage {
  id: string;
  credits: number;
  priceCents: number;
  badge?: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "p5", credits: 5, priceCents: 490 },
  { id: "p15", credits: 15, priceCents: 790, badge: "Mais escolhido" },
  { id: "p40", credits: 40, priceCents: 1990, badge: "Melhor preço" },
];

export const packageById = (id: string) => CREDIT_PACKAGES.find((p) => p.id === id);

export const formatBRL = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Preço por crédito, para mostrar "R$ 0,53 por arte". */
export const perCredit = (p: CreditPackage) => formatBRL(Math.round(p.priceCents / p.credits));

/** Validade do Pix gerado (minutos). */
export const PIX_EXPIRES_MINUTES = 30;

/** Recompensa por usar o app: a cada XP_PER_CREDIT de XP em missões, 1 crédito grátis no Estúdio. */
export const XP_PER_CREDIT = 200;
export const xpReward = (xpTotal: number) => {
  const into = xpTotal % XP_PER_CREDIT;
  return { earned: Math.floor(xpTotal / XP_PER_CREDIT), into, missing: XP_PER_CREDIT - into, pct: Math.round((into / XP_PER_CREDIT) * 100) };
};
