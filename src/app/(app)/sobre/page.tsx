"use client";

import { useTranslations } from "next-intl";
import { LEVELS } from "@/config/catalog";
import { XP_MONTH_GOAL } from "@/config/credits";
import { SUPPORT } from "@/config/business";
import { TopBar } from "@/components/shell";
import { AbuMascot } from "@/components/brand";
import { Paw } from "@/components/icons";
import { levelName } from "@/i18n/catalog";
import { loose } from "@/i18n/keys";

const strong = { strong: (c: React.ReactNode) => <strong>{c}</strong> };
/** Itens da privacidade, em about.privacy.<chave>. */
const PRIVACY = ["who", "links", "where", "studio", "payments", "push", "delete"] as const;

export default function Sobre() {
  const t = useTranslations("about");
  const tAll = loose(useTranslations());
  return (
    <>
      <TopBar title={t("title")} back="/conta" emoji="🐾" />
      <main className="main">
        <section className="stack-lg" aria-labelledby="historia">
          <div className="achados-hero">
            <div className="achados-hero__abu"><AbuMascot width={96} alt={t("abuAlt")} /></div>
            <div>
              <p className="studio-title" style={{ fontSize: "2rem", margin: 0 }}>{t("heading")}</p>
              <p className="muted" style={{ margin: 0 }}>{t("sub")}</p>
            </div>
          </div>
          <article className="stack intro-diary anim-rise about-letter" style={{ rotate: "-1deg" }}>
            <h1 id="historia">{t("storyTitle")}</h1>
            {(["p1", "p2", "p3", "p4"] as const).map((k) => <p key={k} className="intro__text">{t(`story.${k}`)}</p>)}
            <p className="intro__text about-letter__sign">{t("story.sign1")}<br />{t("story.sign2")} <Paw size={22} className="intro-diary__paw" /></p>
          </article>
        </section>

        <section id="niveis" className="card stack" aria-labelledby="niveis-t">
          <h2 id="niveis-t">{t("levelsTitle")}</h2>
          <p className="small">{t("levelsIntro")}</p>
          <ul className="small" style={{ margin: 0, paddingLeft: "1.2em", display: "grid", gap: 4 }}>
            <li>{t.rich("pawsForever", strong)}</li>
            <li>{t.rich("pawsMonth", { ...strong, goal: XP_MONTH_GOAL })}</li>
          </ul>
          <ol className="levels">
            {LEVELS.map((l, i) => (
              <li key={l.minXp}>
                <span className="levels__n">{i + 1}</span>
                <span className="levels__t">{levelName(tAll, { level: i, endless: 0 })}</span>
                <span className="levels__xp">{l.minXp === 0 ? t("start") : `${l.minXp} 🐾`}</span>
              </li>
            ))}
            <li><span className="levels__n">∞</span><span className="levels__t">{t("endless", { last: levelName(tAll, { level: LEVELS.length - 1, endless: 0 }) })}</span><span className="levels__xp">{t("each")}</span></li>
          </ol>
        </section>

        <section className="stack" aria-labelledby="priv">
          <h2 id="priv">{t("privacyTitle")}</h2>
          <ul className="small privacy-list">
            {PRIVACY.map((k) => <li key={k}>{t.rich(`privacy.${k}`, strong)}</li>)}
          </ul>
          <p className="caption" style={{ margin: 0 }}>{t("terms")}</p>
        </section>

        <section id="estudio" className="stack" aria-labelledby="estudio-t">
          <h2 id="estudio-t">{t("studioTitle")}</h2>
          <p className="small">{t("studioText")}</p>
        </section>

        <section className="stack" aria-labelledby="sup">
          <h2 id="sup">{t("supportTitle")}</h2>
          {SUPPORT.email ? <p className="small"><a href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</a></p> : <p className="small muted">{t("noSupport")}</p>}
        </section>
      </main>
    </>
  );
}
