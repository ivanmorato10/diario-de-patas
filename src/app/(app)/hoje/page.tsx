"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useCatalog } from "@/i18n/catalog";
import { useFormat, usePrefs } from "@/i18n/use-format";
import { useErrorText } from "@/i18n/use-error";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { DogAvatar, MediaImage } from "@/components/media";
import { AbuSays } from "@/components/brand";
import { IconCheck, IconPlus, IconShuffle, IconStar } from "@/components/icons";
import { collectionMissions } from "@/components/mission-ui";
import { UpcomingCareCard } from "@/components/health-ui";
import { PawBurst } from "@/components/celebrate";
import { ImportDemoCard } from "@/components/import-demo";
import { cycleContext, useStore } from "@/data/store";
import { DomainError } from "@/data/demo-repository";
import { LIMITS } from "@/config/business";
import { DAILY_SLOTS, type DailySlot } from "@/config/cycle";
import { activeSpecials, daysWithMemories, missionStatus } from "@/domain/cycle";
import { levelFor, missionById } from "@/domain/missions";
import { XpRewardBar } from "@/components/xp-reward";
import { CreditCelebration, celebrationSeen, markCelebrationSeen } from "@/components/credit-celebration";
import { monthReward } from "@/config/credits";
import { AchadinhosCard } from "@/components/achadinhos-card";
import { MedAlert } from "@/components/med-alert";
import { FamilyNudge } from "@/components/family-nudge";
import { WelcomeFamily } from "@/components/welcome-family";
import { MemoryRotator } from "@/components/memory-rotator";
import { NameAsk } from "@/components/name-ask";
import { upcomingCare } from "@/domain/health";

export default function Hoje() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo, reload, patchDog } = useStore();
  const [swapping, setSwapping] = useState<DailySlot | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [ideasHelp, setIdeasHelp] = useState(false);
  // 200 patinhas que chegaram por outro caminho (outra pessoa da família, indicação): comemora ao abrir Hoje,
  // uma vez por cachorro e mês neste aparelho (quem completou pela missão já viu na hora).
  const [party, setParty] = useState(false);
  const partyDog = snap?.dog?.id;
  const partyMonth = snap?.today.slice(0, 7);
  const reached = !!snap && monthReward(snap.xpMonth).reached;
  useEffect(() => {
    if (!partyDog || !partyMonth || !reached || celebrationSeen(partyDog, partyMonth)) return;
    markCelebrationSeen(partyDog, partyMonth);
    setParty(true);
  }, [partyDog, partyMonth, reached]);
  const care = useMemo(() => (snap ? upcomingCare(snap.health, snap.today) : []), [snap]);
  const t = useTranslations("today");
  const cat = useCatalog(snap?.dog?.name ?? "");
  const f = useFormat();
  const { region } = usePrefs();
  const errText = useErrorText();

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !repo) return <main className="main"><PageLoading /></main>;

  const dog = snap.dog;
  const ctx = cycleContext(snap, region)!;
  const level = levelFor(snap.xpTotal);
  const levelPct = level.nextAt ? Math.min(100, Math.round((snap.xpTotal / level.nextAt) * 100)) : 100;
  const hasFirst = snap.completions.some((c) => c.missionId === "M01");
  const plan = snap.dailyPlan;
  const daily = plan ? DAILY_SLOTS.map((s) => ({ slot: s, m: missionById(plan.slots[s.id])! })) : [];
  const doneToday = daily.filter(({ m }) => missionStatus(m, ctx) === "completed").length;
  const specials = activeSpecials(snap.today, dog.birthDate, region).filter((w) => missionStatus(w.mission, ctx) !== "completed");
  const focusCollection = daily.find(({ m }) => missionStatus(m, ctx) !== "completed")?.m.collectionId ?? "primeiras-lembrancas";
  const colMissions = collectionMissions(focusCollection);
  const colDone = colMissions.filter((m) => snap.completions.some((c) => c.missionId === m.id)).length;
  const last = snap.entries[0];
  const days = daysWithMemories(snap.entries);

  async function swap(slot: DailySlot) {
    setSwapping(slot);
    setSwapError(null);
    const dogAtStart = snap!.dog?.id;
    try {
      const plan = await repo!.swapDaily(slot);
      // O plano novo (devolvido pelo servidor) entra na hora; a conferência completa vem depois, sem virar erro.
      patchDog(dogAtStart, (s) => ({ ...s, dailyPlan: plan }));
      void reload().catch(() => undefined);
    } catch (e) {
      setSwapError(errText(e instanceof DomainError ? e : null, "today.swapFailed"));
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
            <h1 id="dog-title" className="hoje-title">{t("title", { dog: dog.name })}</h1>
            <div className="hoje-badges">
              <span className="hoje-level"><IconStar size={14} /> {cat.level(level)}</span>
              <span className="hoje-xp">🐾 {t("paws", { count: snap.xpTotal })}</span>
            </div>
          </div>
        </section>

        {/* Com a família no diário, o nome aparece em "guardada por" e nos ossinhos: pergunta uma vez. */}
        {(snap.members?.length ?? 0) >= 2 ? <NameAsk /> : null}

        {/* Remédio na hora certa continua no topo: é cuidado, não cobrança. */}
        <MedAlert meds={snap.health.medications} today={snap.today} dogName={dog.name} />

        {/* Primeiro as lembranças: este é o cantinho do cachorro. */}
        <section className="stack hoje-memory" aria-labelledby="last-title">
          <h2 id="last-title" className="sr-only">{t("lastMemory")}</h2>
          {last ? (
            <>
              <MemoryRotator entries={snap.entries} dogName={dog.name} />
              <Link href="/guardar" className="btn btn--primary btn--block"><IconPlus /> {t("saveMoment")}</Link>
              {/* Aviso de espaço só quando estiver chegando ao limite. */}
              {LIMITS.maxEntries - snap.entries.length <= 10 ? <p className="caption" style={{ margin: 0, textAlign: "center" }}>{snap.entries.length >= LIMITS.maxEntries ? t("full") : t("spaceLeft", { count: LIMITS.maxEntries - snap.entries.length })}</p> : null}
            </>
          ) : (
            <div className="card stitched empty stack" style={{ boxShadow: "none" }}>
              <p>{t("emptyText", { dog: dog.name })}</p>
              <Link href="/guardar" className="btn btn--primary"><IconPlus /> {t("saveFirst")}</Link>
            </div>
          )}
        </section>

        <FamilyNudge />
        <WelcomeFamily />

        {!hasFirst ? (
          <>
            <Link href="/missoes/ola-mundo" className="hero-mission" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="hero-mission__band">
                <span className="mission-stamp" aria-hidden="true"><IconStar /></span>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="caption hero-mission__kicker">{cat.collection("primeiras-lembrancas").title}</span>
                  <h2 style={{ fontSize: "1.25rem" }}>{cat.title("M01")}</h2>
                </div>
              </div>
              <div className="stack" style={{ padding: 20 }}>
                <p>{t("firstMissionText", { dog: dog.name })}</p>
                <div className="row-between"><span className="chip chip--reward">+10 🐾</span><span className="btn btn--primary btn--small">{t("seeMission")}</span></div>
              </div>
            </Link>
          </>
        ) : (
          <section className="stack" aria-labelledby="daily-title">
            <div className="row-between" style={{ alignItems: "center" }}>
              <h2 id="daily-title" className="title-with-info">
                {t("ideas")}
                <button type="button" className="xp-reward__info" onClick={() => setIdeasHelp((v) => !v)} aria-expanded={ideasHelp} aria-label={t("ideasHelpLabel")}>ⓘ</button>
              </h2>
              <span className="caption" aria-live="polite">{t("doneOf", { n: doneToday, total: 3 })}</span>
            </div>
            {ideasHelp ? <p className="caption" style={{ marginTop: -6 }}>{t("ideasHelp", { dog: dog.name })}</p> : null}

            {specials.map((w) => (
              <Link key={w.mission.id} href={`/missoes/${w.mission.slug}`} className="hero-mission" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="hero-mission__band">
                  <span className="mission-stamp" aria-hidden="true"><IconStar /></span>
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="caption hero-mission__kicker">{t("specialUntil", { date: f.date(w.end) })}</span>
                    <h3 style={{ fontSize: "1.25rem" }}>{cat.title(w.mission)}</h3>
                  </div>
                </div>
                <div className="stack" style={{ padding: 20 }}>
                  <p>{cat.mission(w.mission).description}</p>
                  <div className="row-between"><span className="chip chip--reward">+{w.mission.xp} 🐾</span><span className="btn btn--primary btn--small">{t("seeSpecial")}</span></div>
                </div>
              </Link>
            ))}

            {doneToday === 3 ? (
              <div className="card stack daily-done" role="status" style={{ position: "relative", overflow: "visible" }}>
                <PawBurst />
                <h3>{t("allDone")}</h3>
                <div className="stack">
                  <Link href="/albuns?aba=colecoes" className="btn btn--primary btn--block">{t("seeCollections")}</Link>
                  <Link href="/guardar" className="btn btn--secondary btn--block">{t("saveAnother")}</Link>
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
                        <span className="caption">{cat.slot(slot.id)}</span>
                        <strong>{cat.title(m)}</strong>
                        <span className="small muted">{done ? t("savedToday") : cat.mission(m).description}</span>
                      </span>
                      <span className="chip chip--reward">{done ? <IconCheck size={14} /> : null}+{m.xp} 🐾</span>
                    </Link>
                    {!done ? (
                      <button type="button" className="daily-card__swap" onClick={() => swap(slot.id)} disabled={!!swapping} aria-label={t("swapLabel", { title: cat.title(m) })} title={t("swapTitle")}>
                        {swapping === slot.id ? "…" : <IconShuffle size={18} />}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {swapError ? <p className="field-error" role="alert">{swapError}</p> : null}
            <Link href="/missoes" className="btn btn--secondary btn--block hoje-all"><IconStar size={18} /> {t("allMissions")}</Link>
          </section>
        )}

        <ImportDemoCard />

        {care.length ? <UpcomingCareCard items={care} today={snap.today} compact /> : null}

        <XpRewardBar xpMonth={snap.xpMonth} compact />
        <CreditCelebration open={party} dogName={snap.dog.name} onClose={() => setParty(false)} />
        <AchadinhosCard />

      </main>
    </>
  );
}
