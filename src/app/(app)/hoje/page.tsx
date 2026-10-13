"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { DogAvatar, MediaImage } from "@/components/media";
import { AbuSays } from "@/components/brand";
import { IconCheck, IconPlus, IconShuffle, IconStar } from "@/components/icons";
import { collectionMissions, collectionTitle } from "@/components/mission-ui";
import { UpcomingCareCard } from "@/components/health-ui";
import { PawBurst } from "@/components/celebrate";
import { ImportDemoCard } from "@/components/import-demo";
import { cycleContext, useStore } from "@/data/store";
import { DomainError } from "@/data/demo-repository";
import { DAILY_SLOTS, type DailySlot } from "@/config/cycle";
import { activeSpecials, daysWithMemories, missionStatus } from "@/domain/cycle";
import { levelFor, missionById } from "@/domain/missions";
import { formatCivilDate } from "@/domain/dates";
import { upcomingCare } from "@/domain/health";

export default function Hoje() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo, reload } = useStore();
  const [swapping, setSwapping] = useState<DailySlot | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const care = useMemo(() => (snap ? upcomingCare(snap.health, snap.today) : []), [snap]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !repo) return <main className="main"><PageLoading /></main>;

  const dog = snap.dog;
  const ctx = cycleContext(snap)!;
  const level = levelFor(snap.xpTotal);
  const levelPct = level.nextAt ? Math.min(100, Math.round((snap.xpTotal / level.nextAt) * 100)) : 100;
  const hasFirst = snap.completions.some((c) => c.missionId === "M01");
  const plan = snap.dailyPlan;
  const daily = plan ? DAILY_SLOTS.map((s) => ({ slot: s, m: missionById(plan.slots[s.id])! })) : [];
  const doneToday = daily.filter(({ m }) => missionStatus(m, ctx) === "completed").length;
  const specials = activeSpecials(snap.today, dog.birthDate, dog.name).filter((w) => missionStatus(w.mission, ctx) !== "completed");
  const focusCollection = daily.find(({ m }) => missionStatus(m, ctx) !== "completed")?.m.collectionId ?? "primeiras-lembrancas";
  const colMissions = collectionMissions(focusCollection);
  const colDone = colMissions.filter((m) => snap.completions.some((c) => c.missionId === m.id)).length;
  const last = snap.entries[0];
  const days = daysWithMemories(snap.entries);

  async function swap(slot: DailySlot) {
    setSwapping(slot);
    setSwapError(null);
    try {
      await repo!.swapDaily(slot);
      await reload();
    } catch (e) {
      setSwapError(e instanceof DomainError ? e.message : "Não conseguimos trocar agora. Tente de novo.");
    } finally {
      setSwapping(null);
    }
  }

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
            <span className="caption">{level.nextAt ? `${level.nextAt - snap.xpTotal} XP até “${level.nextTitle}”` : ""}</span>
          </div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={level.nextAt ?? snap.xpTotal} aria-valuenow={snap.xpTotal} aria-label="Progresso até o próximo nível">
            <span style={{ width: `${levelPct}%` }} />
          </div>
          <p className="caption">{days} {days === 1 ? "dia com lembranças" : "dias com lembranças"} · {snap.medals.length} {snap.medals.length === 1 ? "medalha" : "medalhas"}</p>
        </section>

        {!hasFirst ? (
          <>
            <AbuSays>Que tal começar pela primeira página? Uma foto em que dê para ver bem {dog.name}.</AbuSays>
            <Link href="/missoes/ola-mundo" className="hero-mission" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-mission__band">
                <span className="mission-stamp" aria-hidden="true"><IconStar /></span>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="caption hero-mission__kicker">Primeiras lembranças</span>
                  <h2 style={{ fontSize: "1.25rem" }}>Olá, mundo</h2>
                </div>
              </div>
              <div className="stack" style={{ padding: 20 }}>
                <p>A primeira página do diário. Depois dela, chegam as missões do dia.</p>
                <div className="row-between"><span className="chip chip--reward">+10 XP</span><span className="btn btn--primary btn--small">Ver missão</span></div>
              </div>
            </Link>
          </>
        ) : (
          <section className="stack" aria-labelledby="daily-title">
            <div className="row-between">
              <h2 id="daily-title">Missões do dia</h2>
              <span className="chip chip--neutral" aria-live="polite">{doneToday} de 3 hoje</span>
            </div>

            {specials.map((w) => (
              <Link key={w.mission.id} href={`/missoes/${w.mission.slug}`} className="hero-mission" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="hero-mission__band">
                  <span className="mission-stamp" aria-hidden="true"><IconStar /></span>
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="caption hero-mission__kicker">Especial · até {formatCivilDate(w.end)}</span>
                    <h3 style={{ fontSize: "1.25rem" }}>{w.title}</h3>
                  </div>
                </div>
                <div className="stack" style={{ padding: 20 }}>
                  <p>{w.mission.description}</p>
                  <div className="row-between"><span className="chip chip--reward">+{w.mission.xp} XP</span><span className="btn btn--primary btn--small">Ver especial</span></div>
                </div>
              </Link>
            ))}

            {doneToday === 3 ? (
              <div className="card stack daily-done" role="status" style={{ position: "relative", overflow: "visible" }}>
                <PawBurst />
                <h3>Aventuras de hoje concluídas!</h3>
                <p>Suas fotos já estão no álbum. Amanhã tem mais — e você ainda pode explorar suas coleções.</p>
                <div className="stack">
                  <Link href="/albuns?aba=colecoes" className="btn btn--primary btn--block">Ver coleções</Link>
                  <Link href="/guardar" className="btn btn--secondary btn--block">Guardar mais um momento</Link>
                </div>
              </div>
            ) : null}

            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {daily.map(({ slot, m }) => {
                const done = missionStatus(m, ctx) === "completed";
                return (
                  <li key={slot.id} className={`card daily-card${done ? " daily-card--done" : ""}`}>
                    <Link href={`/missoes/${m.slug}`} className="daily-card__main">
                      <span className={`mission-stamp${done ? " mission-stamp--done" : ""}`} aria-hidden="true">{done ? <IconCheck /> : <IconStar />}</span>
                      <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                        <span className="caption">{slot.title}</span>
                        <strong>{m.title}</strong>
                        <span className="small muted">{done ? "Feita hoje" : m.description}</span>
                      </span>
                      <span className="chip chip--reward">{done ? <IconCheck size={14} /> : null}+{m.xp} XP</span>
                    </Link>
                    {!done ? (
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => swap(slot.id)} disabled={!!swapping} aria-label={`Trocar a missão “${m.title}”`}>
                        <IconShuffle size={18} /> {swapping === slot.id ? "Trocando…" : "Trocar"}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {swapError ? <p className="field-error" role="alert">{swapError}</p> : null}
            <p className="caption">Sem pressa: o que não for feito hoje não tira pontos. Amanhã chegam outras.</p>
            <Link href="/missoes" className="btn btn--ghost" style={{ alignSelf: "flex-start" }}>Ver todas as missões</Link>
          </section>
        )}

        <ImportDemoCard />

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
