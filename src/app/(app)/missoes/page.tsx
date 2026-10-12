"use client";

import { useMemo } from "react";
import { COLLECTIONS, MISSIONS } from "@/config/catalog";
import { missionState } from "@/domain/missions";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { MissionRow } from "@/components/mission-ui";

export default function Missoes() {
  const { ready, snap, unavailable } = useRequireDiary();
  const completed = useMemo(() => new Set(snap?.completions.map((c) => c.missionId) ?? []), [snap]);
  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready) return <main className="main"><PageLoading /></main>;
  return (
    <>
      <TopBar title="Missões" back="/hoje" />
      <main className="main">
        <p className="muted">Convites para registrar momentos naturais — sem pressa e sem sequência obrigatória. Cada missão dá pontos uma única vez.</p>
        <p className="small"><strong>{completed.size}</strong> de {MISSIONS.length} concluídas</p>
        {COLLECTIONS.filter((c) => c.hasMissions).map((c) => (
          <section key={c.id} className="stack" aria-labelledby={`col-${c.id}`}>
            <h2 id={`col-${c.id}`}>{c.title}</h2>
            {MISSIONS.filter((m) => m.collectionId === c.id).map((m) => <MissionRow key={m.id} m={m} state={missionState(m, completed)} />)}
          </section>
        ))}
      </main>
    </>
  );
}
