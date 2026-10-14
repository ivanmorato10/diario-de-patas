"use client";

import Link from "next/link";
import { REAL_MODE } from "@/config/mode";
import { XP_PER_CREDIT, xpReward } from "@/config/credits";
import { Paw } from "@/components/icons";

/** Barra "próximo crédito grátis": cada 200 XP de missões vira 1 arte no Estúdio. */
export function XpRewardBar({ xpTotal, compact = false, levelLine }: { xpTotal: number; compact?: boolean; levelLine?: React.ReactNode }) {
  const r = xpReward(xpTotal);
  const close = r.missing <= 40;
  return (
    <section className={`xp-reward${close ? " is-close" : ""}${compact ? " xp-reward--compact" : ""}`} aria-label="Recompensa por XP">
      <div className="xp-reward__row">
        <span className="xp-reward__gift" aria-hidden="true">🎁</span>
        <div className="xp-reward__text">
          <strong>{close ? `Falta pouco! Só ${r.missing} XP` : `Faltam ${r.missing} XP`} para 1 arte grátis</strong>
          {!compact ? <span>A cada {XP_PER_CREDIT} XP em missões você ganha 1 crédito no Estúdio{r.earned ? ` · já ganhou ${r.earned}` : ""}.</span> : null}
        </div>
      </div>
      <div className="xp-reward__bar" role="progressbar" aria-valuemin={0} aria-valuemax={XP_PER_CREDIT} aria-valuenow={r.into} aria-label="XP até o próximo crédito">
        <span style={{ width: `${Math.max(3, r.pct)}%` }} />
        <i aria-hidden="true"><Paw size={14} /></i>
      </div>
      {levelLine ? <p className="xp-reward__level">{levelLine}</p> : null}
      <div className="xp-reward__foot">
        <span>{r.into} / {XP_PER_CREDIT} XP</span>
        {!compact ? (REAL_MODE ? <Link href="/missoes">Ver missões</Link> : <span>Com conta, o crédito vai para o Estúdio</span>) : null}
      </div>
    </section>
  );
}

/** Aviso de crédito ganho ao concluir uma missão. */
export function CreditEarned({ n }: { n: number }) {
  if (!n) return null;
  return (
    <div className="notice notice--positive xp-earned" role="status">
      <span className="xp-reward__gift" aria-hidden="true">🎁</span>
      <span><strong>+{n} {n === 1 ? "crédito" : "créditos"} no Estúdio!</strong> Você chegou a mais {XP_PER_CREDIT} XP. <Link href="/estudio">Criar uma arte</Link></span>
    </div>
  );
}
