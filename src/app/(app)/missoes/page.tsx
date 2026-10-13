"use client";

import { useMemo, useState } from "react";
import { COLLECTIONS, MISSIONS } from "@/config/catalog";
import { missionState } from "@/domain/missions";
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
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "open", label: "Disponíveis", count: MISSIONS.length - doneOnce },
    { id: "done", label: "Concluídas", count: doneOnce },
  ];
  return (
    <>
      <TopBar title="Missões" back="/hoje" />
      <main className="main">
        <p className="muted">Convites para registrar momentos naturais — sem pressa e sem sequência obrigatória. Fotos antigas valem. Cada missão dá pontos uma única vez.</p>
        <p className="small"><strong>{doneOnce}</strong> de {MISSIONS.length} concluídas · as missões do dia ficam em Hoje e as coleções em Álbuns</p>
        <div role="group" aria-label="Filtrar missões" className="row" style={{ gap: 8 }}>
          {filters.map((f) => (
            <button key={f.id} type="button" className={`chip ${filter === f.id ? "" : "chip--outline"}`} style={{ minHeight: 44, padding: "0 16px", border: filter === f.id ? "1px solid var(--brand-primary)" : undefined, cursor: "pointer" }} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
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
