"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCatalog } from "@/i18n/catalog";
import { useFormat, usePrefs } from "@/i18n/use-format";
import { useParams } from "next/navigation";
import { missionById, missionBySlug } from "@/domain/missions";
import { activeSpecials, missionStatus, setsContaining, type CycleState } from "@/domain/cycle";
import { cycleContext } from "@/data/store";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { MissionStamp } from "@/components/mission-ui";
import { IconCheck, IconInfo } from "@/components/icons";


export default function MissaoDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const mission = missionBySlug(slug);
  const { ready, snap, unavailable } = useRequireDiary();
  const t = useTranslations("mission");
  const cat = useCatalog(snap?.dog?.name ?? "");
  const f = useFormat();
  const { region } = usePrefs();

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;
  if (!mission) {
    return (<><TopBar back="/missoes" /><main className="main"><div className="card empty"><h1>{t("notFound")}</h1><Link href="/missoes" className="btn btn--secondary">{t("seeMissions")}</Link></div></main></>);
  }
  const ctx = cycleContext(snap, region)!;
  const text = cat.mission(mission);
  const state: CycleState = missionStatus(mission, ctx);
  const prereq = mission.prerequisiteId ? missionById(mission.prerequisiteId) : null;
  const sets = setsContaining(mission.id).map((id) => cat.set(id).title);
  const window = mission.kind === "special" ? activeSpecials(snap.today, snap.dog.birthDate, region).find((w) => w.mission.id === mission.id) : null;
  const title = text.title;
  const advances = mission.advancesItem ? missionById(mission.advancesItem) : null;
  const stampState = state === "completed" ? "completed" : state === "available" ? "available" : "locked";

  return (
    <>
      <TopBar back="/hoje" />
      <main className="main">
        <section className="stack">
          <div className="row" style={{ flexWrap: "wrap" }}>
            <MissionStamp state={stampState} />
            <span className="caption" style={{ fontWeight: 600 }}>{mission.kind !== "once" ? `${t(`kind.${mission.kind}`)} · ` : ""}{cat.collection(mission.collectionId).title}</span>
          </div>
          <h1>{title}</h1>
          <p>{text.description}</p>
          {mission.optional && mission.kind === "once" ? <span className="chip chip--neutral" style={{ alignSelf: "flex-start" }}>{t("optional")}</span> : null}
        </section>

        <section className="card stack" aria-label={t("criterionLabel")}>
          <div className="row-between" style={{ alignItems: "flex-start", gap: 10 }}>
            <div className="stack" style={{ gap: 4 }}>
              <span className="caption">{t("criterionTitle")}</span>
              <p style={{ fontWeight: 600, margin: 0 }}>{text.criterion}</p>
            </div>
            <span className="chip chip--reward" style={{ flex: "none" }}>+{mission.xp} 🐾</span>
          </div>
          {text.homeAlternative ? <p className="small" style={{ margin: 0 }}>🏠 {text.homeAlternative}</p> : null}
        </section>

        {state === "completed" ? (
          <div className="notice notice--positive" role="status"><IconCheck /><span>{mission.kind === "daily" ? t("doneToday") : mission.kind === "special" ? t("doneThisYear") : t("done")}</span></div>
        ) : state === "locked" ? (
          <div className="notice notice--info"><IconInfo /><span>{t("opensAfter", { title: prereq ? cat.title(prereq) : "" })}</span></div>
        ) : state === "not_today" ? (
          <div className="notice notice--info"><IconInfo /><span>{t("notToday")}</span></div>
        ) : state === "out_of_window" ? (
          <div className="notice notice--info"><IconInfo /><span>{mission.id === "S01" && !snap.dog.birthDate ? t("outOfWindowBirthday") : t("outOfWindow")}</span></div>
        ) : null}

        <details className="more-details">
          <summary>{t("moreDetails")}</summary>
          <dl className="stack small" style={{ margin: "10px 0 0", gap: 8 }}>
            <div className="row-between"><dt className="muted">{t("valid")}</dt><dd style={{ margin: 0, textAlign: "right" }}>{mission.kind === "daily" ? t("validDaily") : mission.kind === "special" ? (window ? t("validUntil", { date: f.date(window.end) }) : t("validYearly")) : t("validOnce")}</dd></div>
            <div className="row-between"><dt className="muted">{t("album")}</dt><dd style={{ margin: 0 }}>{cat.collection(mission.collectionId).title}</dd></div>
            {sets.length ? <div className="row-between"><dt className="muted">{t("collection")}</dt><dd style={{ margin: 0 }}>{sets.join(", ")}</dd></div> : null}
            {advances ? <div className="row-between"><dt className="muted">{t("alsoAdvances")}</dt><dd style={{ margin: 0, textAlign: "right" }}>“{cat.title(advances)}”</dd></div> : null}
            <div className="row-between"><dt className="muted">{t("oldPhoto")}</dt><dd style={{ margin: 0 }}>{t("oldPhotoOk")}</dd></div>
            {prereq ? <div className="row-between"><dt className="muted">{t("before")}</dt><dd style={{ margin: 0 }}>{cat.title(prereq)}</dd></div> : null}
          </dl>
        </details>

        <div className="stack">
          {state === "available" ? (
            <Link href={`/guardar?missao=${mission.slug}`} className="btn btn--primary btn--block">{t("sendPhoto")}</Link>
          ) : state === "completed" ? (
            <Link href={`/albuns/${mission.collectionId}`} className="btn btn--secondary btn--block">{t("openAlbum")}</Link>
          ) : null}
          <Link href={mission.kind === "once" ? "/missoes" : "/hoje"} className="btn btn--secondary btn--block">{mission.kind === "once" ? t("otherMissions") : t("backToday")}</Link>
        </div>
      </main>
    </>
  );
}
