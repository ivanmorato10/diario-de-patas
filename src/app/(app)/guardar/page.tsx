"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBlobUrl, useStore } from "@/data/store";
import {
  DomainError, findEntryByHash, newId, saveEntry, submitMission, type ProcessedImage, type SubmitResult,
} from "@/data/demo-repository";
import { COLLECTIONS, MISSIONS, type CollectionId } from "@/config/catalog";
import { LIMITS } from "@/config/business";
import { isCivilDate } from "@/domain/dates";
import { missionBySlug, missionState } from "@/domain/missions";
import type { DiaryEntry } from "@/domain/types";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { PhotoPicker } from "@/components/photo-picker";
import { AbuSays } from "@/components/brand";
import { IconAlert, IconCheck, IconInfo, IconRotate, IconStar } from "@/components/icons";
import { rotateProcessed } from "@/lib/image";
import { collectionTitle } from "@/components/mission-ui";

type Step =
  | { kind: "pick" }
  | { kind: "edit" }
  | { kind: "confirm"; entry: DiaryEntry }
  | { kind: "result"; entry: DiaryEntry; result: SubmitResult | null; limitMessage?: string };

function GuardarInner() {
  const params = useSearchParams();
  const mission = missionBySlug(params.get("missao") ?? "");
  const { ready, snap, unavailable } = useRequireDiary();
  const { db, reload } = useStore();

  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [img, setImg] = useState<ProcessedImage | null>(null);
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState("");
  const [albums, setAlbums] = useState<CollectionId[]>([]);
  const [dupe, setDupe] = useState<DiaryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entryKey = useRef<string>("");
  const submissionKey = useRef<string>("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previewUrl = useBlobUrl(img?.display);

  const completed = useMemo(() => new Set(snap?.completions.map((c) => c.missionId) ?? []), [snap]);
  const missionAvailable = mission && missionState(mission, completed) === "available";

  useEffect(() => {
    if (snap && !date) setDate(snap.today);
  }, [snap, date]);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step.kind]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !db) return <main className="main"><PageLoading /></main>;
  const dog = snap.dog;
  const back = mission ? `/missoes/${mission.slug}` : "/diario";

  async function onPicked(p: ProcessedImage) {
    setImg(p);
    setError(null);
    entryKey.current = newId(); // nova tentativa = nova chave; retries reutilizam
    setDupe(await findEntryByHash(db!, p.hash));
    setStep({ kind: "edit" });
  }

  async function save() {
    if (!img || busy) return;
    if (!isCivilDate(date) || date > snap!.today) {
      setError("Escolha uma data até hoje.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const entry = await saveEntry(db!, {
        requestKey: entryKey.current, image: img, caption, occurredDate: date,
        source: "free", missionId: null, albumIds: mission ? [] : albums,
      });
      await reload();
      if (mission && missionAvailable) {
        submissionKey.current = newId();
        setStep({ kind: "confirm", entry });
      } else {
        setStep({ kind: "result", entry, result: null });
      }
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Não conseguimos guardar a foto. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(entry: DiaryEntry, matches: boolean) {
    if (!mission || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitMission(db!, {
        requestKey: submissionKey.current, missionId: mission.id, entryId: entry.id,
        status: matches ? "approved" : "uncertain", reasonCode: matches ? "OWNER_CONFIRMED" : "OWNER_UNSURE",
        mode: "demo_manual", providerVersion: null,
      });
      await reload();
      setStep({ kind: "result", entry, result });
    } catch (err) {
      if (err instanceof DomainError && err.code === "DAILY_LIMIT") {
        await reload();
        setStep({ kind: "result", entry, result: null, limitMessage: err.message });
      } else {
        setError(err instanceof DomainError ? err.message : "Não conseguimos registrar agora. A foto já está no diário — tente de novo.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title={mission ? mission.title : "Guardar momento"} back={back} />
      <main className="main">
        {step.kind === "pick" ? (
          <section className="stack-lg">
            <h1 ref={headingRef} tabIndex={-1}>{mission ? "Escolha a foto" : "Guardar um momento"}</h1>
            {mission ? (
              <div className="card card--soft stack" style={{ gap: 4 }}>
                <span className="caption">O que precisa aparecer</span>
                <p style={{ fontWeight: 600 }}>{mission.criterion}</p>
              </div>
            ) : <p className="muted">Qualquer momento vale. Fotos antigas da galeria também.</p>}
            {snap.entries.length >= LIMITS.maxEntries ? (
              <div className="notice notice--warn" role="alert"><IconAlert /><span>O diário chegou ao limite de {LIMITS.maxEntries} lembranças desta versão de teste. Nada foi apagado; para guardar novas, exclua alguma antiga.</span></div>
            ) : <PhotoPicker onPicked={onPicked} />}
            <p className="caption">JPEG, PNG ou WebP até {Math.round(LIMITS.maxUploadBytes / 1024 / 1024)} MB. A localização da foto é removida ao guardar.</p>
          </section>
        ) : null}

        {step.kind === "edit" && img ? (
          <section className="stack-lg">
            <h1 ref={headingRef} tabIndex={-1}>Ajuste e guarde</h1>
            <div className="stack">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {previewUrl ? <img src={previewUrl} alt="Pré-visualização da foto escolhida" className="photo" style={{ objectFit: "contain", background: "#f1efe9" }} /> : null}
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button type="button" className="btn btn--secondary btn--small" onClick={async () => setImg(await rotateProcessed(img))}><IconRotate /> Girar</button>
                <button type="button" className="btn btn--ghost" onClick={() => { setImg(null); setStep({ kind: "pick" }); }}>Trocar foto</button>
              </div>
            </div>
            {dupe ? (
              <div className="notice notice--info"><IconInfo /><span>Essa mesma foto já está no diário ({dupe.occurredDate.split("-").reverse().join("/")}). Você pode guardar de novo se quiser.</span></div>
            ) : null}
            <div className="field">
              <label htmlFor="caption">Legenda <span className="muted">(opcional)</span></label>
              <textarea id="caption" className="textarea" value={caption} maxLength={LIMITS.captionMaxChars} onChange={(e) => setCaption(e.target.value)} placeholder="Uma frase curta, se quiser" />
              <span className="hint">{caption.length}/{LIMITS.captionMaxChars}</span>
            </div>
            <div className="field">
              <label htmlFor="date">Quando aconteceu</label>
              <input id="date" type="date" className="input" value={date} max={snap.today} onChange={(e) => setDate(e.target.value)} />
            </div>
            {!mission ? (
              <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 600, marginBottom: 8 }}>Colocar em álbuns <span className="muted">(opcional)</span></legend>
                <p className="caption">Fotos livres enfeitam o álbum, mas não contam como conquista.</p>
                {COLLECTIONS.map((c) => (
                  <label key={c.id} className="check">
                    <input type="checkbox" checked={albums.includes(c.id)} onChange={(e) => setAlbums((a) => (e.target.checked ? [...a, c.id] : a.filter((x) => x !== c.id)))} />
                    <span>{c.title}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            <p className="caption">Se houver outras pessoas na foto, garanta que elas concordam antes de compartilhar.</p>
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <div className="stack">
              <button type="button" className="btn btn--primary btn--block" onClick={save} disabled={busy}>
                {busy ? "Guardando…" : mission ? "Guardar e continuar" : "Guardar foto"}
              </button>
              <Link href={back} className="btn btn--ghost btn--block">Cancelar</Link>
            </div>
          </section>
        ) : null}

        {step.kind === "confirm" ? (
          <section className="stack-lg">
            <h1 ref={headingRef} tabIndex={-1}>A foto mostra isso?</h1>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Foto enviada para a missão" className="photo" />
            ) : null}
            <div className="card card--soft stack" style={{ gap: 4 }}>
              <span className="caption">Critério</span>
              <p style={{ fontWeight: 600 }}>{mission!.criterion}</p>
            </div>
            <div className="notice notice--info"><IconInfo /><span>Modo demonstração: sem IA, quem confirma é você. A foto já está guardada no diário.</span></div>
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <div className="stack">
              <button type="button" className="btn btn--primary btn--block" onClick={() => confirm(step.entry, true)} disabled={busy}>Sim, mostra</button>
              <button type="button" className="btn btn--secondary btn--block" onClick={() => confirm(step.entry, false)} disabled={busy}>Não tenho certeza</button>
            </div>
          </section>
        ) : null}

        {step.kind === "result" ? (
          <ResultView step={step} dogName={dog.name} missionTitle={mission?.title} firstAchievement={snap.completions.length === 1 && !!step.result?.xpAwarded} previewUrl={previewUrl} headingRef={headingRef} />
        ) : null}
      </main>
    </>
  );
}

function ResultView({
  step, dogName, missionTitle, firstAchievement, previewUrl, headingRef,
}: {
  step: Extract<Step, { kind: "result" }>;
  dogName: string;
  missionTitle?: string;
  firstAchievement: boolean;
  previewUrl: string | null;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const r = step.result;
  const approved = r?.submission.status === "approved";
  return (
    <section className="stack-lg" aria-live="polite">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <div className={`polaroid tape${approved ? " celebrate" : ""}`} style={{ margin: "8px 6px 0" }}><img src={previewUrl} alt={`Lembrança de ${dogName}`} className="photo" /><p className="polaroid__note">{dogName}</p></div>
      ) : null}
      {approved ? (
        <>
          <div className="stack">
            <span className="chip chip--reward" style={{ alignSelf: "flex-start" }}><IconStar size={16} /> {r!.xpAwarded > 0 ? `+${r!.xpAwarded} XP` : "Pontos já contados"}</span>
            <h1 ref={headingRef} tabIndex={-1}>Conquista: {missionTitle}</h1>
            <p className="muted">{r!.alreadyCompleted ? "Essa missão já estava concluída — a foto foi guardada e os pontos não somam de novo." : `Guardada no álbum ${collectionTitle(collectionOf(r!.submission.missionId))}.`}</p>
            <p className="caption"><IconCheck size={14} style={{ verticalAlign: "-2px" }} /> Confirmada por você (modo demonstração, sem IA)</p>
          </div>
          {firstAchievement ? <AbuSays>Essa merece um lugar no álbum!</AbuSays> : null}
          <div className="stack">
            <Link href={`/albuns/${collectionOf(r!.submission.missionId)}`} className="btn btn--primary btn--block">Abrir álbum</Link>
            <Link href="/hoje" className="btn btn--secondary btn--block">Próxima aventura</Link>
          </div>
        </>
      ) : r ? (
        <>
          <h1 ref={headingRef} tabIndex={-1}>Guardada no diário</h1>
          <p>Não deu para confirmar o tema nesta foto. Ela ficou no diário, sem pontos — você pode tentar outra quando quiser.</p>
          <div className="stack">
            <Link href={`/guardar?missao=${slugFor(r.submission.missionId)}`} className="btn btn--primary btn--block">Tentar outra foto</Link>
            <Link href="/diario" className="btn btn--secondary btn--block">Ver no diário</Link>
          </div>
        </>
      ) : (
        <>
          <h1 ref={headingRef} tabIndex={-1}>Guardada no diário</h1>
          {step.limitMessage ? (
            <div className="notice notice--warn" role="status"><IconAlert /><span>{step.limitMessage}</span></div>
          ) : <p className="muted">Mais uma lembrança de {dogName}.</p>}
          <div className="stack">
            <Link href="/diario" className="btn btn--primary btn--block">Ver no diário</Link>
            <Link href="/hoje" className="btn btn--secondary btn--block">Voltar para Hoje</Link>
          </div>
        </>
      )}
    </section>
  );
}

function collectionOf(id: string): CollectionId {
  return MISSIONS.find((m) => m.id === id)?.collectionId ?? "primeiras-lembrancas";
}
function slugFor(id: string) {
  return MISSIONS.find((m) => m.id === id)?.slug ?? "";
}

export default function GuardarPage() {
  return (
    <Suspense fallback={<main className="main"><PageLoading /></main>}>
      <GuardarInner />
    </Suspense>
  );
}
