"use client";

import Link from "next/link";
import { useState } from "react";
import { XP_MONTH_GOAL, monthReward } from "@/config/credits";
import { useStore } from "@/data/store";
import { IconStar, Paw } from "@/components/icons";

/**
 * Arte do mês, numa linha: patinhas do mês até a meta (200 → 1 crédito no Estúdio, uma vez por mês).
 * A explicação fica atrás do ⓘ, para não repetir o parágrafo toda vez.
 */
export function XpRewardBar({ xpMonth }: { xpMonth: number; compact?: boolean }) {
  const { snap } = useStore();
  const [help, setHelp] = useState(false);
  const r = monthReward(xpMonth);
  const close = !r.reached && r.missing <= 40;
  const name = snap?.dog?.name ?? "seu cachorro";
  return (
    <section className={`xp-reward xp-reward--compact${close ? " is-close" : ""}${r.reached ? " is-done" : ""}`} aria-label="Arte do mês">
      <div className="xp-reward__row">
        <span className="xp-reward__gift" aria-hidden="true">{r.reached ? "🏆" : "🎁"}</span>
        <div className="xp-reward__text">
          {r.reached ? (
            <strong>Você ganhou 1 crédito! <Link href="/estudio">Criar arte →</Link></strong>
          ) : (
            <strong>Arte do mês · {Math.min(xpMonth, XP_MONTH_GOAL)}/{XP_MONTH_GOAL} 🐾</strong>
          )}
        </div>
        <button type="button" className="xp-reward__info" onClick={() => setHelp((v) => !v)} aria-expanded={help} aria-label="Como funciona a arte do mês">ⓘ</button>
      </div>
      {!r.reached ? (
        <div className="xp-reward__bar" role="progressbar" aria-valuemin={0} aria-valuemax={XP_MONTH_GOAL} aria-valuenow={Math.min(xpMonth, XP_MONTH_GOAL)} aria-label="Patinhas do mês">
          <span style={{ width: `${Math.max(3, r.pct)}%` }} />
          <i aria-hidden="true">{r.reached ? <IconStar size={14} /> : <Paw size={14} />}</i>
        </div>
      ) : null}
      {help ? <p className="caption" style={{ margin: 0 }}>Cada missão vale patinhas 🐾. Juntando {XP_MONTH_GOAL} no mês, você ganha 1 crédito para criar uma arte de {name} no Estúdio. A contagem recomeça todo mês.</p> : null}
    </section>
  );
}

/** Aviso ao concluir a missão que completa as patinhas do mês. */
export function CreditEarned({ n }: { n: number }) {
  if (!n) return null;
  return (
    <div className="notice notice--positive xp-earned" role="status">
      <span className="xp-reward__gift" aria-hidden="true">🏆</span>
      <span><strong>Você ganhou 1 crédito!</strong> <Link href="/estudio">Criar arte →</Link></span>
    </div>
  );
}
