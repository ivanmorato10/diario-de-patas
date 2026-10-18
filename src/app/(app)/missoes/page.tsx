"use client";

import { useMemo, useState } from "react";
import { COLLECTIONS, MISSIONS } from "@/config/catalog";
import { missionById, missionState } from "@/domain/missions";
import { formatCivilDate } from "@/domain/dates";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { MissionRow } from "@/components/mission-ui";

type Filter = "open" | "done";

export default function Missoes() {
  const { ready, snap, unavailable } = useRequireDiary();
  const [filter, setFilter] = useState<Filter>("open");
  const completed = useMemo(() => new Set(snap?.completions.map((c) => c.missionId) ?? []), [snap]);
  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready) return <main className="main"><PageLoading /></main>;
  const doneOnce = MISSIONS.filter((m) => completed.has(m.id)).length;
  const shown = MISSIONS.filter((m) => (filter === "done") === completed.has(m.id));
  // Ideias do dia, especiais e itens do presente do mês também contam (podem ser feitos de novo em outros ciclos).
  const repeatable = (snap!.completions ?? []).filter((c) => { const k = missionById(c.missionId)?.kind; return k === "daily" || k === "special" || k === "collection_item"; })
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "open", label: "Disponíveis", count: MISSIONS.length - doneOnce },
    { id: "done", label: "Concluídas", count: doneOnce + repeatable.length },
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
        {filter === "done" && repeatable.length ? (
          <section className="stack" aria-labelledby="col-ideias">
            <h2 id="col-ideias">Ideias do dia e especiais</h2>
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {repeatable.map((c) => (
                <li key={c.instanceKey} className="card row-between" style={{ padding: "10px 14px" }}>
                  <span>{missionById(c.missionId)?.title ?? "Missão"}</span>
                  <span className="caption">{formatCivilDate(c.date ?? c.completedAt.slice(0, 10))}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {shown.length === 0 && !(filter === "done" && repeatable.length) ? (
          <p className="muted">{filter === "done" ? "Nenhuma missão concluída ainda. A primeira é “Olá, mundo”." : "Todas as missões foram concluídas. O diário continua aberto para qualquer momento."}</p>
        ) : null}
        {COLLECTIONS.filter((c) => c.hasMissions).map((c) => {
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
