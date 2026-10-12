"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { DogAvatar, MediaImage } from "@/components/media";
import { AbuSays } from "@/components/brand";
import { IconPlus, IconShuffle, IconStar } from "@/components/icons";
import { MissionRow, collectionMissions, collectionTitle } from "@/components/mission-ui";
import { dailySuggestions, levelFor, missionState } from "@/domain/missions";
import { formatCivilDate } from "@/domain/dates";
import { upcomingCare } from "@/domain/health";
import { UpcomingCareCard } from "@/components/health-ui";

export default function Hoje() {
  const { ready, snap, unavailable } = useRequireDiary();
  const [swap, setSwap] = useState(0);
  const care = useMemo(() => (snap ? upcomingCare(snap.health, snap.today) : []), [snap]);
  const completed = useMemo(() => new Set(snap?.completions.map((c) => c.missionId) ?? []), [snap]);
  const suggestions = useMemo(
    () => (snap?.dog ? dailySuggestions(completed, snap.dog.preferences, snap.today, swap) : []),
    [snap, completed, swap],
  );

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;

  const dog = snap.dog;
  const level = levelFor(snap.xpTotal);
  const [hero, ...rest] = suggestions;
  const focusCollection = hero?.collectionId ?? "primeiras-lembrancas";
  const colMissions = collectionMissions(focusCollection);
  const colDone = colMissions.filter((m) => completed.has(m.id)).length;
  const last = snap.entries[0];
  const levelPct = level.nextAt ? Math.min(100, Math.round((snap.xpTotal / level.nextAt) * 100)) : 100;

  return (
    <>
      <TopBar />
      <main className="main">
        <section className="row" aria-labelledby="dog-title">
          <DogAvatar mediaId={dog.photoMediaId} name={dog.name} size="lg" />
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <h1 id="dog-title" style={{ overflowWrap: "anywhere" }}>Diário de {dog.name}</h1>
            <p className="small muted">{level.title} · {snap.xpTotal} XP</p>
          </div>
        </section>

        <section className="card stack" aria-label="Pontos e nível" style={{ padding: 16 }}>
          <div className="row-between">
            <span className="chip chip--reward"><IconStar size={16} /> {snap.xpTotal} XP</span>
            <span className="caption">{level.nextAt ? `${level.nextAt - snap.xpTotal} XP até “${level.nextTitle}”` : "Todos os níveis desta versão alcançados"}</span>
          </div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={level.nextAt ?? snap.xpTotal} aria-valuenow={snap.xpTotal} aria-label="Progresso até o próximo nível">
            <span style={{ width: `${levelPct}%` }} />
          </div>
        </section>

        {snap.completions.length === 0 ? <AbuSays>Que tal começar pela primeira página? Uma foto em que dê para ver bem {dog.name}.</AbuSays> : null}

        {hero ? (
          <section className="stack" aria-labelledby="sug-title">
            <div className="section-title">
              <h2 id="sug-title">Uma nova aventura para {dog.name}</h2>
            </div>
            <Link href={`/missoes/${hero.slug}`} className="hero-mission" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-mission__band">
                <span className="mission-stamp" aria-hidden="true"><IconStar /></span>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="caption hero-mission__kicker">{collectionTitle(hero.collectionId)}</span>
                  <h3 style={{ fontSize: "1.25rem" }}>{hero.title}</h3>
                </div>
              </div>
              <div className="stack" style={{ padding: 20 }}>
                <p>{hero.description}</p>
                <div className="row-between">
                  <span className="chip chip--reward">+{hero.xp} XP</span>
                  <span className="btn btn--primary btn--small">Ver missão</span>
                </div>
              </div>
            </Link>
            {rest.map((m) => <MissionRow key={m.id} m={m} state={missionState(m, completed)} />)}
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              {suggestions.length > 1 ? (
                <button type="button" className="btn btn--ghost" onClick={() => setSwap((s) => s + 1)}>
                  <IconShuffle /> Trocar sugestões
                </button>
              ) : <span />}
              <Link href="/missoes" className="btn btn--ghost">Ver todas as missões</Link>
            </div>
          </section>
        ) : (
          <section className="card card--soft stack">
            <h2>Todas as missões desta versão foram concluídas</h2>
            <p>O diário continua aberto para qualquer momento. Novas missões chegam em versões futuras.</p>
          </section>
        )}

        {care.length ? <UpcomingCareCard items={care} today={snap.today} compact /> : null}

        <section className="card stack" aria-labelledby="album-prog">
          <div className="row-between">
            <h2 id="album-prog" style={{ fontSize: "1.0625rem" }}>{collectionTitle(focusCollection)}</h2>
            <Link href={`/albuns/${focusCollection}`} className="small">Abrir álbum</Link>
          </div>
          <p className="small muted">{colDone} de {colMissions.length} conquistas neste álbum</p>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={colMissions.length} aria-valuenow={colDone} aria-label={`Conquistas em ${collectionTitle(focusCollection)}`}>
            <span style={{ width: `${(colDone / colMissions.length) * 100}%` }} />
          </div>
        </section>

        <section className="stack" aria-labelledby="last-title">
          <h2 id="last-title">Última lembrança</h2>
          {last ? (
            <Link href={`/diario#${last.id}`} className="polaroid tape" style={{ display: "block", textDecoration: "none", margin: "8px 6px 0" }}>
              <MediaImage id={last.mediaId} variant="display" alt={last.caption ? `Lembrança: ${last.caption}` : `Lembrança de ${dog.name}`} className="photo" />
              <p className="polaroid__note">{last.caption || dog.name}</p>
              <p className="caption polaroid__meta">{formatCivilDate(last.occurredDate)}</p>
            </Link>
          ) : (
            <div className="card stitched empty" style={{ boxShadow: "none" }}>
              <p>Nenhuma foto ainda. O primeiro momento pode ser qualquer um — até uma soneca.</p>
            </div>
          )}
        </section>

        <div className="sticky-action">
          <Link href="/guardar" className="btn btn--primary"><IconPlus /> Guardar momento</Link>
        </div>
      </main>
    </>
  );
}
