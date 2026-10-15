"use client";

import { petText } from "@/domain/pet-text";
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
import { XpRewardBar } from "@/components/xp-reward";
import { AchadinhosCard } from "@/components/achadinhos-card";
import { MedAlert } from "@/components/med-alert";
import { FamilyNudge } from "@/components/family-nudge";
import { MemoryRotator } from "@/components/memory-rotator";
import { NameAsk } from "@/components/name-ask";
import { formatCivilDate } from "@/domain/dates";
import { upcomingCare } from "@/domain/health";

export default function Hoje() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo, reload } = useStore();
  const [swapping, setSwapping] = useState<DailySlot | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [ideasHelp, setIdeasHelp] = useState(false);
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
          <DogAvatar mediaId={dog.photoMediaId} name={dog.name} crop={dog.avatarCrop} size="lg" />
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <h1 id="dog-title" className="hoje-title">Diário de {dog.name}</h1>
            <div className="hoje-badges">
              <span className="hoje-level"><IconStar size={14} /> {level.title}</span>
              <span className="hoje-xp">🐾 {snap.xpTotal} patinhas</span>
            </div>
          </div>
        </section>

        {/* Com a família no diário, o nome aparece em "guardada por" e nos ossinhos: pergunta uma vez. */}
        {(snap.members?.length ?? 0) >= 2 ? <NameAsk note="Seu nome aparece para a família nas fotos e cartinhas." /> : null}

        {/* Remédio na hora certa continua no topo: é cuidado, não cobrança. */}
        <MedAlert meds={snap.health.medications} today={snap.today} dogName={dog.name} />

        {/* Primeiro as lembranças: este é o cantinho do cachorro. */}
        <section className="stack hoje-memory" aria-labelledby="last-title">
          <h2 id="last-title" className="sr-only">Última lembrança</h2>
          {last ? (
            <>
              <MemoryRotator entries={snap.entries} dogName={dog.name} />
              <Link href="/guardar" className="btn btn--primary btn--block"><IconPlus /> Guardar momento</Link>
            </>
          ) : (
            <div className="card stitched empty stack" style={{ boxShadow: "none" }}>
              <p>O diário de {dog.name} está esperando a primeira página. Pode ser qualquer momento, até uma soneca.</p>
              <Link href="/guardar" className="btn btn--primary"><IconPlus /> Guardar o primeiro momento</Link>
            </div>
          )}
        </section>

        <FamilyNudge />

        {!hasFirst ? (
          <>
            <Link href="/missoes/ola-mundo" className="hero-mission" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-mission__band">
                <span className="mission-stamp" aria-hidden="true"><IconStar /></span>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="caption hero-mission__kicker">Primeiras lembranças</span>
                  <h2 style={{ fontSize: "1.25rem" }}>Olá, mundo</h2>
                </div>
              </div>
              <div className="stack" style={{ padding: 20 }}>
                <p>Uma foto em que dê para ver bem {dog.name}. Depois dela, chegam ideias novas todo dia.</p>
                <div className="row-between"><span className="chip chip--reward">+10 🐾</span><span className="btn btn--primary btn--small">Ver missão</span></div>
              </div>
            </Link>
          </>
        ) : (
          <section className="stack" aria-labelledby="daily-title">
            <div className="row-between" style={{ alignItems: "center" }}>
              <h2 id="daily-title" className="title-with-info">
                Ideias para hoje
                <button type="button" className="xp-reward__info" onClick={() => setIdeasHelp((v) => !v)} aria-expanded={ideasHelp} aria-label="O que são as ideias para hoje">ⓘ</button>
              </h2>
              <span className="caption" aria-live="polite">{doneToday} de 3</span>
            </div>
            {ideasHelp ? <p className="caption" style={{ marginTop: -6 }}>São as missões do dia: sugestões de fotos de {dog.name}. Sem pressa: o que não der para fazer hoje não tira nada.</p> : null}

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
                  <p>{petText(w.mission.description, dog.name)}</p>
                  <div className="row-between"><span className="chip chip--reward">+{w.mission.xp} 🐾</span><span className="btn btn--primary btn--small">Ver especial</span></div>
                </div>
              </Link>
            ))}

            {doneToday === 3 ? (
              <div className="card stack daily-done" role="status" style={{ position: "relative", overflow: "visible" }}>
                <PawBurst />
                <h3>Momentos guardados! Até a próxima aventura 🐾</h3>
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
                  <li key={slot.id} className={`card daily-card daily-card--compact${done ? " daily-card--done" : ""}`}>
                    <Link href={`/missoes/${m.slug}`} className="daily-card__main">
                      <span className={`mission-stamp${done ? " mission-stamp--done" : ""}`} aria-hidden="true">{done ? <IconCheck /> : <IconStar />}</span>
                      <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                        <span className="caption">{slot.title}</span>
                        <strong>{m.title}</strong>
                        <span className="small muted">{done ? "Guardada hoje" : petText(m.description, dog.name)}</span>
                      </span>
                      <span className="chip chip--reward">{done ? <IconCheck size={14} /> : null}+{m.xp} 🐾</span>
                    </Link>
                    {!done ? (
                      <button type="button" className="daily-card__swap" onClick={() => swap(slot.id)} disabled={!!swapping} aria-label={`Outra ideia no lugar de “${m.title}”`} title="Outra ideia">
                        {swapping === slot.id ? "…" : <IconShuffle size={18} />}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {swapError ? <p className="field-error" role="alert">{swapError}</p> : null}
            <Link href="/missoes" className="btn btn--secondary btn--block hoje-all"><IconStar size={18} /> Ver todas as missões</Link>
          </section>
        )}

        <ImportDemoCard />

        {care.length ? <UpcomingCareCard items={care} today={snap.today} compact /> : null}

        <XpRewardBar xpMonth={snap.xpMonth} compact />
        <AchadinhosCard />

      </main>
    </>
  );
}
