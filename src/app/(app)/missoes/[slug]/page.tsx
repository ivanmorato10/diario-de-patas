"use client";

import { petText } from "@/domain/pet-text";
import Link from "next/link";
import { useParams } from "next/navigation";
import { missionById, missionBySlug } from "@/domain/missions";
import { activeSpecials, missionStatus, setsContaining, type CycleState } from "@/domain/cycle";
import { PERMANENT_SETS } from "@/config/cycle";
import { cycleContext } from "@/data/store";
import { formatCivilDate } from "@/domain/dates";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { MissionStamp, collectionTitle } from "@/components/mission-ui";
import { IconCheck, IconInfo } from "@/components/icons";

const KIND_LABEL = { once: null, daily: "Missão do dia", collection_item: "Item de coleção", special: "Especial" } as const;

export default function MissaoDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const mission = missionBySlug(slug);
  const { ready, snap, unavailable } = useRequireDiary();

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;
  if (!mission) {
    return (<><TopBar back="/missoes" /><main className="main"><div className="card empty"><h1>Missão não encontrada</h1><Link href="/missoes" className="btn btn--secondary">Ver missões</Link></div></main></>);
  }
  const ctx = cycleContext(snap)!;
  const dogName = snap.dog.name;
  const state: CycleState = missionStatus(mission, ctx);
  const prereq = mission.prerequisiteId ? missionById(mission.prerequisiteId) : null;
  const sets = setsContaining(mission.id).map((id) => PERMANENT_SETS.find((s) => s.id === id)!.title);
  const window = mission.kind === "special" ? activeSpecials(snap.today, snap.dog.birthDate, snap.dog.name).find((w) => w.mission.id === mission.id) : null;
  const title = window?.title ?? mission.title;
  const advances = mission.advancesItem ? missionById(mission.advancesItem) : null;
  const stampState = state === "completed" ? "completed" : state === "available" ? "available" : "locked";

  return (
    <>
      <TopBar back="/hoje" />
      <main className="main">
        <section className="stack">
          <div className="row" style={{ flexWrap: "wrap" }}>
            <MissionStamp state={stampState} />
            <span className="caption" style={{ fontWeight: 600 }}>{KIND_LABEL[mission.kind] ? `${KIND_LABEL[mission.kind]} · ` : ""}{collectionTitle(mission.collectionId)}</span>
          </div>
          <h1>{title}</h1>
          <p>{petText(mission.description, dogName)}</p>
          {mission.optional && mission.kind === "once" ? <span className="chip chip--neutral" style={{ alignSelf: "flex-start" }}>Opcional</span> : null}
        </section>

        <section className="card stack" aria-label="O que a foto precisa mostrar">
          <div className="row-between" style={{ alignItems: "flex-start", gap: 10 }}>
            <div className="stack" style={{ gap: 4 }}>
              <span className="caption">📸 O que precisa aparecer na foto</span>
              <p style={{ fontWeight: 600, margin: 0 }}>{petText(mission.criterion, dogName)}</p>
            </div>
            <span className="chip chip--reward" style={{ flex: "none" }}>+{mission.xp} 🐾</span>
          </div>
          {mission.homeAlternative ? <p className="small" style={{ margin: 0 }}>🏠 {petText(mission.homeAlternative, dogName)}</p> : null}
        </section>

        {state === "completed" ? (
          <div className="notice notice--positive" role="status"><IconCheck /><span>{mission.kind === "daily" ? "Feita hoje!" : mission.kind === "special" ? "Feita neste ano!" : "Missão concluída!"}</span></div>
        ) : state === "locked" ? (
          <div className="notice notice--info"><IconInfo /><span>Abre depois de “{prereq?.title}”.</span></div>
        ) : state === "not_today" ? (
          <div className="notice notice--info"><IconInfo /><span>Não está nas ideias de hoje. Pode aparecer em outro dia.</span></div>
        ) : state === "out_of_window" ? (
          <div className="notice notice--info"><IconInfo /><span>Aparece só na época da data{mission.id === "S01" && !snap.dog.birthDate ? " (precisa da data de nascimento no perfil)" : ""}.</span></div>
        ) : null}

        <details className="more-details">
          <summary>Mais detalhes</summary>
          <dl className="stack small" style={{ margin: "10px 0 0", gap: 8 }}>
            <div className="row-between"><dt className="muted">Vale</dt><dd style={{ margin: 0, textAlign: "right" }}>{mission.kind === "daily" ? "No dia em que for sorteada" : mission.kind === "special" ? (window ? `Até ${formatCivilDate(window.end)}` : "Uma vez por ano") : "Uma única vez"}</dd></div>
            <div className="row-between"><dt className="muted">Álbum</dt><dd style={{ margin: 0 }}>{collectionTitle(mission.collectionId)}</dd></div>
            {sets.length ? <div className="row-between"><dt className="muted">Coleção</dt><dd style={{ margin: 0 }}>{sets.join(", ")}</dd></div> : null}
            {advances ? <div className="row-between"><dt className="muted">Também avança</dt><dd style={{ margin: 0, textAlign: "right" }}>“{advances.title}”</dd></div> : null}
            <div className="row-between"><dt className="muted">Foto antiga</dt><dd style={{ margin: 0 }}>Vale</dd></div>
            {prereq ? <div className="row-between"><dt className="muted">Antes</dt><dd style={{ margin: 0 }}>{prereq.title}</dd></div> : null}
          </dl>
        </details>

        <div className="stack">
          {state === "available" ? (
            <Link href={`/guardar?missao=${mission.slug}`} className="btn btn--primary btn--block">Enviar foto</Link>
          ) : state === "completed" ? (
            <Link href={`/albuns/${mission.collectionId}`} className="btn btn--secondary btn--block">Abrir álbum</Link>
          ) : null}
          <Link href={mission.kind === "once" ? "/missoes" : "/hoje"} className="btn btn--secondary btn--block">{mission.kind === "once" ? "Ver outras missões" : "Voltar para Hoje"}</Link>
        </div>
      </main>
    </>
  );
}
