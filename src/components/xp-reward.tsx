"use client";

import Link from "next/link";
import { XP_MONTH_GOAL, monthReward } from "@/config/credits";
import { IconStar, Paw } from "@/components/icons";

/**
 * Patinhas (os pontos das missões) contadas como presente, não como cobrança:
 * as do mês (recomeçam a cada mês; 200 trazem a arte do mês, uma vez por mês) e as totais (níveis).
 */
export function XpRewardBar({ xpMonth, compact = false }: { xpMonth: number; compact?: boolean }) {
  const r = monthReward(xpMonth);
  const close = !r.reached && r.missing <= 40;
  return (
    <section className={`xp-reward${close ? " is-close" : ""}${r.reached ? " is-done" : ""}${compact ? " xp-reward--compact" : ""}`} aria-label="Patinhas do mês">
      <div className="xp-reward__row">
        <span className="xp-reward__gift" aria-hidden="true">{r.reached ? "🏆" : "🎁"}</span>
        <div className="xp-reward__text">
          <strong>{r.reached ? "Arte do mês garantida! 🎨" : "Presente do mês: uma arte do Abu"}</strong>
          <span>{r.reached ? "Ela já está no Estúdio esperando por vocês." : `Cada missão vale patinhas 🐾. Juntando ${XP_MONTH_GOAL} no mês, o Abu te dá uma arte no Estúdio.`}</span>
        </div>
      </div>
      <div className="xp-reward__bar" role="progressbar" aria-valuemin={0} aria-valuemax={XP_MONTH_GOAL} aria-valuenow={Math.min(xpMonth, XP_MONTH_GOAL)} aria-label="Patinhas do mês até a arte de presente">
        <span style={{ width: `${Math.max(3, r.pct)}%` }} />
        <i aria-hidden="true">{r.reached ? <IconStar size={14} /> : <Paw size={14} />}</i>
      </div>
      <div className="xp-reward__foot"><span><strong>{Math.min(xpMonth, XP_MONTH_GOAL)} de {XP_MONTH_GOAL}</strong> patinhas este mês</span><span>Uma nova aventura começa a cada mês</span></div>
    </section>
  );
}

/** Aviso ao concluir a missão que completa as 200 patinhas do mês. */
export function CreditEarned({ n }: { n: number }) {
  if (!n) return null;
  return (
    <div className="notice notice--positive xp-earned" role="status">
      <span className="xp-reward__gift" aria-hidden="true">🏆</span>
      <span><strong>Arte do mês garantida! O Abu deixou 1 crédito de presente no Estúdio.</strong> <Link href="/estudio">Criar a arte</Link></span>
    </div>
  );
}
