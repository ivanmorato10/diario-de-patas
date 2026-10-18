"use client";

import { useMemo, useState } from "react";
import { COLLECTIONS, MISSIONS } from "@/config/catalog";
import { missionById, missionState } from "@/domain/missions";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import Link from "next/link";
import { MissionRow } from "@/components/mission-ui";
import { MediaImage } from "@/components/media";
import { IconCheck } from "@/components/icons";

type Filter = "open" | "done";

const shortDate = (d: string) => {
  const [y, mo, da] = d.split("-").map(Number);
  return new Date(y, mo - 1, da).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: y === new Date().getFullYear() ? undefined : "2-digit" }).replace(" de ", " ").replace(".", "");
};

export default function Missoes() {
  const { ready, snap, unavailable } = useRequireDiary();
  const [filter, setFilter] = useState<Filter>("open");
  const completed = useMemo(() => new Set(snap?.completions.map((c) => c.missionId) ?? []), [snap]);
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
    { id: "open", label: "Disponíveis", count: MISSIONS.length - doneOnce },
    { id: "done", label: "Concluídas", count: done.length },
  ];
  return (
    <>
      <TopBar title="Missões" back="/hoje" />
      <main className="main">
        <p className="page-note">Sem pressa e sem ordem. Fotos antigas valem.</p>
        <div role="group" aria-label="Filtrar missões" className="filter-row">
          {filters.map((f) => (
            <button key={f.id} type="button" className={`filter-chip${filter === f.id ? " is-active" : ""}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>
        {filter === "done" && done.length ? (
          <ul className="done-grid" aria-label="Missões concluídas">
            {done.map(({ c, m, entry }) => {
              const body = (
                <>
                  <span className="done-card__photo">
                    {entry ? <MediaImage id={entry.mediaId} alt={m?.title ?? "Foto da missão"} className="done-card__img" /> : <span className="done-card__img done-card__img--empty" aria-hidden="true">🐾</span>}
                    <span className="done-card__check" aria-label="Concluída"><IconCheck size={16} /></span>
                  </span>
                  <span className="done-card__title">{m?.title ?? "Missão"}</span>
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
          <p className="muted">{filter === "done" ? "Nenhuma missão concluída ainda. A primeira é “Olá, mundo”." : "Todas as missões foram concluídas. O diário continua aberto para qualquer momento."}</p>
        ) : null}
        {filter === "open" && COLLECTIONS.filter((c) => c.hasMissions).map((c) => {
          const list = shown.filter((m) => m.collectionId === c.id);
          if (list.length === 0) return null;
          return (
            <section key={c.id} className="stack" aria-labelledby={`col-${c.id}`}>
              <h2 id={`col-${c.id}`}>{c.title}</h2>
              {list.map((m) => <MissionRow key={m.id} m={m} state={missionState(m, completed)} />)}
            </section>
          );
        })}
      </main>
    </>
  );
}
