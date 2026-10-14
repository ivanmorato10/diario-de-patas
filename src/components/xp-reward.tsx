"use client";

import Link from "next/link";
import { REAL_MODE } from "@/config/mode";
import { XP_MONTH_GOAL, monthReward } from "@/config/credits";
import { IconStar, Paw } from "@/components/icons";

/**
 * Dois contadores: XP do mês (zera na virada do mês; 200 liberam a arte do mês, uma vez por mês)
 * e XP total (nunca zera; níveis e conquistas).
 */
export function XpRewardBar({ xpMonth, xpTotal, compact = false, levelLine }: { xpMonth: number; xpTotal: number; compact?: boolean; levelLine?: React.ReactNode }) {
  const r = monthReward(xpMonth);
  const close = !r.reached && r.missing <= 40;
  return (
    <section className={`xp-reward${close ? " is-close" : ""}${r.reached ? " is-done" : ""}${compact ? " xp-reward--compact" : ""}`} aria-label="XP do mês e XP total">
      <div className="xp-reward__row">
        <span className="xp-reward__gift" aria-hidden="true">{r.reached ? "🏆" : "🎁"}</span>
        <div className="xp-reward__text">
          <strong>{r.reached ? "Arte do mês conquistada! Continue suas aventuras para subir de nível." : `Faltam ${r.missing} XP para ganhar sua arte do mês!`}</strong>
          {!compact ? <span>XP são pontos de experiência ganhos nas missões. Com {XP_MONTH_GOAL} XP no mês, você ganha 1 arte no Estúdio{REAL_MODE ? "" : " (com conta)"}.</span> : null}
        </div>
      </div>
      <div className="xp-reward__counters">
        <span><small>XP do mês</small><b>{xpMonth}</b><small> / {XP_MONTH_GOAL}</small></span>
        <span><small>XP total</small><b>{xpTotal}</b></span>
      </div>
      <div className="xp-reward__bar" role="progressbar" aria-valuemin={0} aria-valuemax={XP_MONTH_GOAL} aria-valuenow={Math.min(xpMonth, XP_MONTH_GOAL)} aria-label="XP do mês até a arte do mês">
        <span style={{ width: `${Math.max(3, r.pct)}%` }} />
        <i aria-hidden="true">{r.reached ? <IconStar size={14} /> : <Paw size={14} />}</i>
      </div>
      {levelLine ? <p className="xp-reward__level">{levelLine}</p> : null}
      {!compact ? (
        <div className="xp-reward__foot">
          <span>O XP do mês zera no dia 1º. O XP total nunca zera.</span>
          <Link href="/missoes">Ver missões</Link>
        </div>
      ) : null}
    </section>
  );
}

/** Aviso ao concluir a missão que completa os 200 XP do mês. */
export function CreditEarned({ n }: { n: number }) {
  if (!n) return null;
  return (
    <div className="notice notice--positive xp-earned" role="status">
      <span className="xp-reward__gift" aria-hidden="true">🏆</span>
      <span><strong>Arte do mês conquistada! +1 crédito no Estúdio.</strong> <Link href="/estudio">Criar uma arte</Link></span>
    </div>
  );
}
