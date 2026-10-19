"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("xpReward");
  const r = monthReward(xpMonth);
  const close = !r.reached && r.missing <= 40;
  const name = snap?.dog?.name ?? "";
  return (
    <section className={`xp-reward xp-reward--compact${close ? " is-close" : ""}${r.reached ? " is-done" : ""}`} aria-label={t("label")}>
      <div className="xp-reward__row">
        <span className="xp-reward__gift" aria-hidden="true">{r.reached ? "🏆" : "🎁"}</span>
        <div className="xp-reward__text">
          {r.reached ? (
            <strong>{t("earned")} <Link href="/estudio">{t("createArt")}</Link></strong>
          ) : (
            <strong>{t("progress", { n: Math.min(xpMonth, XP_MONTH_GOAL), goal: XP_MONTH_GOAL })}</strong>
          )}
        </div>
        <button type="button" className="xp-reward__info" onClick={() => setHelp((v) => !v)} aria-expanded={help} aria-label={t("howLabel")}>ⓘ</button>
      </div>
      {!r.reached ? (
        <div className="xp-reward__bar" role="progressbar" aria-valuemin={0} aria-valuemax={XP_MONTH_GOAL} aria-valuenow={Math.min(xpMonth, XP_MONTH_GOAL)} aria-label={t("pawsLabel")}>
          <span style={{ width: `${Math.max(3, r.pct)}%` }} />
          <i aria-hidden="true">{r.reached ? <IconStar size={14} /> : <Paw size={14} />}</i>
        </div>
      ) : null}
      {help ? <p className="caption" style={{ margin: 0 }}>{t("help", { goal: XP_MONTH_GOAL, dog: name })}</p> : null}
    </section>
  );
}

/** Aviso ao concluir a missão que completa as patinhas do mês. */
export function CreditEarned({ n }: { n: number }) {
  const t = useTranslations("xpReward");
  if (!n) return null;
  return (
    <div className="notice notice--positive xp-earned" role="status">
      <span className="xp-reward__gift" aria-hidden="true">🏆</span>
      <span><strong>{t("earned")}</strong> <Link href="/estudio">{t("createArt")}</Link></span>
    </div>
  );
}
