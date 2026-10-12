"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { missionById, missionBySlug, missionState } from "@/domain/missions";
import { LIMITS } from "@/config/business";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { MissionStamp, collectionTitle } from "@/components/mission-ui";
import { IconCheck, IconInfo } from "@/components/icons";

export default function MissaoDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const mission = missionBySlug(slug);
  const { ready, snap, unavailable } = useRequireDiary();
  const completed = useMemo(() => new Set(snap?.completions.map((c) => c.missionId) ?? []), [snap]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap) return <main className="main"><PageLoading /></main>;
  if (!mission) {
    return (<><TopBar back="/missoes" /><main className="main"><div className="card empty"><h1>Missão não encontrada</h1><Link href="/missoes" className="btn btn--secondary">Ver missões</Link></div></main></>);
  }
  const state = missionState(mission, completed);
  const prereq = mission.prerequisiteId ? missionById(mission.prerequisiteId) : null;
  const remaining = Math.max(0, LIMITS.validationsPerDay - snap.validationsToday);
  const completion = snap.completions.find((c) => c.missionId === mission.id);

  return (
    <>
      <TopBar back="/hoje" />
      <main className="main">
        <section className="stack">
          <div className="row">
            <MissionStamp state={state} />
            <span className="caption" style={{ fontWeight: 600 }}>{collectionTitle(mission.collectionId)}</span>
          </div>
          <h1>{mission.title}</h1>
          <p>{mission.description}</p>
        </section>

        <section className="card stack" aria-label="Detalhes da missão">
          <div className="stack" style={{ gap: 4 }}>
            <span className="caption">O que precisa aparecer na foto</span>
            <p style={{ fontWeight: 600 }}>{mission.criterion}</p>
          </div>
          <dl className="stack small" style={{ margin: 0, gap: 8 }}>
            <div className="row-between"><dt className="muted">Pontos</dt><dd style={{ margin: 0 }}><span className="chip chip--reward">+{mission.xp} XP</span></dd></div>
            <div className="row-between"><dt className="muted">Álbum</dt><dd style={{ margin: 0 }}>{collectionTitle(mission.collectionId)}</dd></div>
            <div className="row-between"><dt className="muted">Foto da galeria</dt><dd style={{ margin: 0 }}>{mission.acceptsGallery ? "Aceita, inclusive fotos antigas" : "Somente câmera"}</dd></div>
            {prereq ? <div className="row-between"><dt className="muted">Pré-requisito</dt><dd style={{ margin: 0 }}>{prereq.title}</dd></div> : null}
          </dl>
        </section>

        {state === "completed" ? (
          <div className="notice notice--positive" role="status">
            <IconCheck />
            <span>Missão concluída{completion?.mode === "demo_manual" ? " (confirmada por você no modo demonstração)" : ""}. Os pontos já foram contados — reenviar não soma de novo.</span>
          </div>
        ) : state === "locked" ? (
          <div className="notice notice--info"><IconInfo /><span>Essa missão abre depois de concluir “{prereq?.title}”.</span></div>
        ) : (
          <div className="notice notice--info">
            <IconInfo />
            <span>
              Nesta demonstração não há validação por IA: depois de escolher a foto, você confirma se ela mostra o critério.
              A conquista fica marcada como confirmada por você. Hoje restam {remaining} de {LIMITS.validationsPerDay} validações.
            </span>
          </div>
        )}

        <div className="stack">
          {state === "available" ? (
            remaining > 0 ? (
              <Link href={`/guardar?missao=${mission.slug}`} className="btn btn--primary btn--block">Enviar foto</Link>
            ) : (
              <>
                <button type="button" className="btn btn--primary btn--block" disabled aria-describedby="limit-msg">Enviar foto</button>
                <p id="limit-msg" className="small muted">As validações de hoje acabaram. Você ainda pode guardar a foto no diário e validar amanhã.</p>
                <Link href="/guardar" className="btn btn--secondary btn--block">Guardar no diário</Link>
              </>
            )
          ) : state === "completed" ? (
            <Link href={`/albuns/${mission.collectionId}`} className="btn btn--secondary btn--block">Abrir álbum</Link>
          ) : null}
          <Link href="/missoes" className="btn btn--ghost btn--block">Trocar missão</Link>
        </div>
      </main>
    </>
  );
}
