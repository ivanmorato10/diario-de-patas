"use client";

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
          <p>{mission.description}</p>
          {mission.optional && mission.kind === "once" ? <span className="chip chip--neutral" style={{ alignSelf: "flex-start" }}>Opcional</span> : null}
        </section>

        <section className="card stack" aria-label="Detalhes da missão">
          <div className="stack" style={{ gap: 4 }}>
            <span className="caption">O que precisa aparecer na foto</span>
            <p style={{ fontWeight: 600 }}>{mission.criterion}</p>
          </div>
          <dl className="stack small" style={{ margin: 0, gap: 8 }}>
            <div className="row-between"><dt className="muted">Pontos</dt><dd style={{ margin: 0 }}><span className="chip chip--reward">+{mission.xp} XP</span></dd></div>
            <div className="row-between"><dt className="muted">Vale</dt><dd style={{ margin: 0, textAlign: "right" }}>{mission.kind === "daily" ? "Uma vez no dia em que for sorteada" : mission.kind === "special" ? (window ? `Uma vez neste ano, até ${formatCivilDate(window.end)}` : "Uma vez por ano, na época da data") : "Uma única vez"}</dd></div>
            <div className="row-between"><dt className="muted">Álbum</dt><dd style={{ margin: 0 }}>{collectionTitle(mission.collectionId)}</dd></div>
            {sets.length ? <div className="row-between"><dt className="muted">Coleção</dt><dd style={{ margin: 0 }}>{sets.join(", ")}</dd></div> : null}
            {advances ? <div className="row-between"><dt className="muted">Também avança</dt><dd style={{ margin: 0, textAlign: "right" }}>“{advances.title}” na coleção (sem XP extra)</dd></div> : null}
            <div className="row-between"><dt className="muted">Foto da galeria</dt><dd style={{ margin: 0 }}>Aceita, inclusive fotos antigas</dd></div>
            {prereq ? <div className="row-between"><dt className="muted">Pré-requisito</dt><dd style={{ margin: 0 }}>{prereq.title}</dd></div> : null}
          </dl>
          {mission.homeAlternative ? (
            <div className="stack" style={{ gap: 4 }}>
              <span className="caption">Alternativa em casa</span>
              <p className="small">{mission.homeAlternative}</p>
            </div>
          ) : null}
        </section>

        {state === "completed" ? (
          <div className="notice notice--positive" role="status">
            <IconCheck />
            <span>{mission.kind === "daily" ? "Feita hoje (confirmada por você). Ela pode voltar em outro dia e render pontos de novo." : mission.kind === "special" ? "Feita neste ano (confirmada por você)." : "Missão concluída (confirmada por você). Os pontos já foram contados — reenviar não soma de novo."}</span>
          </div>
        ) : state === "locked" ? (
          <div className="notice notice--info"><IconInfo /><span>Essa missão abre depois de concluir “{prereq?.title}”.</span></div>
        ) : state === "not_today" ? (
          <div className="notice notice--info"><IconInfo /><span>Essa é uma missão do dia e não está nas sugestões de hoje. Ela pode aparecer em outro dia.</span></div>
        ) : state === "out_of_window" ? (
          <div className="notice notice--info"><IconInfo /><span>Essa missão especial aparece só na época da data{mission.id === "S01" && !snap.dog.birthDate ? " — e precisa da data de nascimento no perfil" : ""}.</span></div>
        ) : (
          <div className="notice notice--info">
            <IconInfo />
            <span>Depois de escolher a foto, você confirma se ela mostra o que a missão pede. A conquista fica marcada como confirmada por você.</span>
          </div>
        )}

        <div className="stack">
          {state === "available" ? (
            <Link href={`/guardar?missao=${mission.slug}`} className="btn btn--primary btn--block">Enviar foto</Link>
          ) : state === "completed" ? (
            <Link href={`/albuns/${mission.collectionId}`} className="btn btn--secondary btn--block">Abrir álbum</Link>
          ) : null}
          <Link href={mission.kind === "once" ? "/missoes" : "/hoje"} className="btn btn--ghost btn--block">{mission.kind === "once" ? "Trocar missão" : "Voltar para Hoje"}</Link>
        </div>
      </main>
    </>
  );
}
