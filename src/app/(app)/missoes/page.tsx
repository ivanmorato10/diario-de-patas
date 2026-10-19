"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useCatalog } from "@/i18n/catalog";
import { useFormat } from "@/i18n/use-format";
import { COLLECTIONS, MISSIONS } from "@/config/catalog";
import { missionById, missionState } from "@/domain/missions";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import Link from "next/link";
import { MissionRow } from "@/components/mission-ui";
import { MediaImage } from "@/components/media";
import { IconCheck } from "@/components/icons";

type Filter = "open" | "done";

export default function Missoes() {
  const { ready, snap, unavailable } = useRequireDiary();
  const [filter, setFilter] = useState<Filter>("open");
  const completed = useMemo(() => new Set(snap?.completions.map((c) => c.missionId) ?? []), [snap]);
  const t = useTranslations("missions");
  const cat = useCatalog(snap?.dog?.name ?? "");
  const f = useFormat();
  const shortDate = (d: string) => f.date(d, d.slice(0, 4) === snap?.today.slice(0, 4) ? "short" : "shortYear");
  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready) return <main className="main"><PageLoading /></main>;
  const doneOnce = MISSIONS.filter((m) => completed.has(m.id)).length;
  const shown = MISSIONS.filter((m) => (filter === "done") === completed.has(m.id));
  // Concluídas: todas as conquistas numa galeria, mais recentes primeiro, cada uma com a sua foto.
  const byId = new Map(snap!.entries.map((e) => [e.id, e]));
  const done = (snap!.completions ?? [])
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .map((c) => ({ c, m: missionById(c.missionId), entry: (c.entryId && byId.get(c.entryId)) || snap!.entries.find((e) => e.missionId === c.missionId && (!c.date || e.occurredDate === c.date)) || null }));
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "open", label: t("filters.open"), count: MISSIONS.length - doneOnce },
    { id: "done", label: t("filters.done"), count: done.length },
  ];
  return (
    <>
      <TopBar title={t("title")} back="/hoje" emoji="⭐" />
      <main className="main">
        <p className="page-note">{t("note")}</p>
        <div role="group" aria-label={t("filterLabel")} className="filter-row">
          {filters.map((f) => (
            <button key={f.id} type="button" className={`filter-chip${filter === f.id ? " is-active" : ""}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>
        {filter === "done" && done.length ? (
          <ul className="done-grid" aria-label={t("doneLabel")}>
            {done.map(({ c, m, entry }) => {
              const body = (
                <>
                  <span className="done-card__photo">
                    {entry ? <MediaImage id={entry.mediaId} alt={m ? cat.title(m) : t("missionPhoto")} className="done-card__img" /> : <span className="done-card__img done-card__img--empty" aria-hidden="true">🐾</span>}
                    <span className="done-card__check" aria-label={t("state.completed")}><IconCheck size={16} /></span>
                  </span>
                  <span className="done-card__title">{m ? cat.title(m) : t("mission")}</span>
                  <span className="done-card__meta">{shortDate(c.date ?? c.completedAt.slice(0, 10))} · +{m?.xp ?? 0} 🐾</span>
                </>
              );
              return (
                <li key={c.instanceKey}>
                  {entry ? <Link href={`/diario?ir=${entry.id}`} className="done-card">{body}</Link>
                    : m ? <Link href={`/missoes/${m.slug}`} className="done-card">{body}</Link>
                    : <div className="done-card">{body}</div>}
                </li>
              );
            })}
          </ul>
        ) : null}
        {(filter === "done" ? done.length === 0 : shown.length === 0) ? (
          <p className="muted">{filter === "done" ? t("noneDone", { first: cat.title("M01") }) : t("allDone")}</p>
        ) : null}
        {filter === "open" && COLLECTIONS.filter((c) => c.hasMissions).map((c) => {
          const list = shown.filter((m) => m.collectionId === c.id);
          if (list.length === 0) return null;
          return (
            <section key={c.id} className="stack" aria-labelledby={`col-${c.id}`}>
              <h2 id={`col-${c.id}`}>{cat.collection(c.id).title}</h2>
              {list.map((m) => <MissionRow key={m.id} m={m} state={missionState(m, completed)} />)}
            </section>
          );
        })}
      </main>
    </>
  );
}
