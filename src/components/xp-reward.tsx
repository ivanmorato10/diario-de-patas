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
          <strong>{r.reached ? "Arte do mês garantida! 🎨 Continue guardando aventuras." : xpMonth === 0 ? `Um mês novo de aventuras! Com ${XP_MONTH_GOAL} patinhas, o Abu faz uma arte de presente.` : `Este mês vocês já juntaram ${xpMonth} patinhas. Com mais ${r.missing}, o Abu faz uma arte de presente!`}</strong>
          {!compact ? <span>Patinhas 🐾 vêm das missões: cada foto guardada vale algumas.</span> : null}
        </div>
      </div>
      <div className="xp-reward__bar" role="progressbar" aria-valuemin={0} aria-valuemax={XP_MONTH_GOAL} aria-valuenow={Math.min(xpMonth, XP_MONTH_GOAL)} aria-label="Patinhas do mês até a arte de presente">
        <span style={{ width: `${Math.max(3, r.pct)}%` }} />
        <i aria-hidden="true">{r.reached ? <IconStar size={14} /> : <Paw size={14} />}</i>
      </div>
      <div className="xp-reward__foot"><span>{Math.min(xpMonth, XP_MONTH_GOAL)} de {XP_MONTH_GOAL} patinhas este mês</span><span>Uma nova aventura começa a cada mês</span></div>
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
