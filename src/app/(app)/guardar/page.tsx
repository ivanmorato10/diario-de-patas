"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBlobUrl, useMedia, useStore } from "@/data/store";
import {
  DomainError, findEntryByHash, newId, saveEntry, submitMission, type ProcessedImage, type SubmitResult,
} from "@/data/demo-repository";
import { COLLECTIONS, MISSIONS, type CollectionId } from "@/config/catalog";
import { LIMITS } from "@/config/business";
import { isCivilDate } from "@/domain/dates";
import { missionBySlug, missionState } from "@/domain/missions";
import type { CivilDate, DiaryEntry } from "@/domain/types";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { PhotoPicker, type PickFailure } from "@/components/photo-picker";
import { AbuSays } from "@/components/brand";
import { IconAlert, IconCheck, IconInfo, IconRotate, IconStar, IconTrash, Paw } from "@/components/icons";
import { rotateProcessed } from "@/lib/image";
import { collectionTitle } from "@/components/mission-ui";

type Step =
  | { kind: "pick" }
  | { kind: "edit" }
  | { kind: "batch" }
  | { kind: "batchDone"; count: number }
  | { kind: "confirm"; entry: DiaryEntry }
  | { kind: "result"; entry: DiaryEntry; result: SubmitResult | null };

/** Uma foto do lote “várias de uma vez”. A chave é fixa: “Guardar todas” de novo não duplica (§2). */
interface BatchItem {
  key: string;
  img: ProcessedImage;
  caption: string;
  date: CivilDate;
  state: "pending" | "saved" | "error";
  message?: string;
}

/** Data sugerida: a do EXIF quando existir e não for futura; senão, hoje. */
const suggestedDate = (img: ProcessedImage, today: CivilDate) => (img.takenDate && img.takenDate <= today ? img.takenDate : today);

function GuardarInner() {
  const params = useSearchParams();
  const mission = missionBySlug(params.get("missao") ?? "");
  const fromEntryId = params.get("entrada");
  const { ready, snap, unavailable } = useRequireDiary();
  const { db, reload } = useStore();

  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [img, setImg] = useState<ProcessedImage | null>(null);
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState("");
  const [albums, setAlbums] = useState<CollectionId[]>([]);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [pickNotes, setPickNotes] = useState<string[]>([]);
  const [dupe, setDupe] = useState<DiaryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entryKey = useRef<string>("");
  const submissionKey = useRef<string>("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Foto já guardada no diário (“Usar numa missão”): nada é enviado de novo.
  const existing = step.kind === "confirm" || step.kind === "result" ? step.entry : null;
  const existingMedia = useMedia(!img && existing ? existing.mediaId : null);
  const previewUrl = useBlobUrl(img?.display ?? existingMedia?.display);

  const completed = useMemo(() => new Set(snap?.completions.map((c) => c.missionId) ?? []), [snap]);
  const missionStateNow = mission ? missionState(mission, completed) : null;
  const missionAvailable = missionStateNow === "available";

  useEffect(() => {
    if (snap && !date) setDate(snap.today);
  }, [snap, date]);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step.kind]);

  // ?missao=…&entrada=… → direto para a confirmação com a foto do diário.
  const [entryError, setEntryError] = useState<string | null>(null);
  useEffect(() => {
    if (!snap || !mission || !fromEntryId || step.kind !== "pick") return;
    const entry = snap.entries.find((e) => e.id === fromEntryId);
    if (!entry) return setEntryError("Não encontramos essa lembrança no diário.");
    if (entry.source === "studio") return setEntryError("Artes do Estúdio não concluem missões — escolha uma foto.");
    if (entry.missionId && entry.missionId !== mission.id) return setEntryError("Essa foto já foi usada em outra missão.");
    if (missionStateNow === "locked") return setEntryError("Essa missão abre depois de concluir “Olá, mundo”.");
    submissionKey.current = newId();
    setStep({ kind: "confirm", entry });
  }, [snap, mission, fromEntryId, step.kind, missionStateNow]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !db) return <main className="main"><PageLoading /></main>;
  const dog = snap.dog;
  const back = fromEntryId ? "/diario" : mission ? `/missoes/${mission.slug}` : "/diario";
  const room = Math.max(0, LIMITS.maxEntries - snap.entries.length);

  async function onPicked(p: ProcessedImage) {
    setImg(p);
    setError(null);
    setPickNotes([]);
    entryKey.current = newId(); // nova tentativa = nova chave; retries reutilizam
    setDate(suggestedDate(p, snap!.today));
    setDupe(await findEntryByHash(db!, p.hash));
    setStep({ kind: "edit" });
  }

  function onPickedMany(imgs: ProcessedImage[], failures: PickFailure[], skipped: number) {
    const notes = failures.map((f) => `${f.name}: ${f.message}`);
    if (skipped > 0) notes.push(`${skipped} ${skipped === 1 ? "foto ficou" : "fotos ficaram"} de fora: o diário só tem espaço para mais ${room} nesta versão de teste.`);
    setPickNotes(notes);
    setError(null);
    if (imgs.length === 0) return;
    if (imgs.length === 1) return void onPicked(imgs[0]);
    setBatch(imgs.map((p) => ({ key: newId(), img: p, caption: "", date: suggestedDate(p, snap!.today), state: "pending" })));
    setStep({ kind: "batch" });
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

  async function saveAll() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const next = [...batch];
    for (const [i, item] of next.entries()) {
      if (item.state === "saved") continue;
      if (!isCivilDate(item.date) || item.date > snap!.today) {
        next[i] = { ...item, state: "error", message: "Escolha uma data até hoje." };
        continue;
      }
      try {
        await saveEntry(db!, { requestKey: item.key, image: item.img, caption: item.caption, occurredDate: item.date, source: "free", missionId: null, albumIds: albums });
        next[i] = { ...item, state: "saved", message: undefined };
      } catch (err) {
        next[i] = { ...item, state: "error", message: err instanceof DomainError ? err.message : "Não conseguimos guardar esta foto. Tente de novo." };
      }
      setBatch([...next]);
    }
    setBatch(next);
    await reload();
    setBusy(false);
    const saved = next.filter((x) => x.state === "saved").length;
    if (saved === next.length) setStep({ kind: "batchDone", count: saved });
    else setError(`${saved} de ${next.length} fotos guardadas. Confira as marcadas e toque em “Guardar todas” de novo — as que já foram não se repetem.`);
  }

  async function confirm(entry: DiaryEntry, matches: boolean) {
    if (!mission || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitMission(db!, {
        requestKey: submissionKey.current, missionId: mission.id, entryId: entry.id,
        status: matches ? "approved" : "uncertain", reasonCode: matches ? "OWNER_CONFIRMED" : "OWNER_UNSURE",
        mode: "owner", providerVersion: null,
      });
      await reload();
      setStep({ kind: "result", entry, result });
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Não conseguimos registrar agora. A foto já está no diário — tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  const albumPicker = (legend: string) => (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 600, marginBottom: 8 }}>{legend} <span className="muted">(opcional)</span></legend>
      <p className="caption">Fotos livres enfeitam o álbum, mas não contam como conquista.</p>
      {COLLECTIONS.map((c) => (
        <label key={c.id} className="check">
          <input type="checkbox" checked={albums.includes(c.id)} onChange={(e) => setAlbums((a) => (e.target.checked ? [...a, c.id] : a.filter((x) => x !== c.id)))} />
          <span>{c.title}</span>
        </label>
      ))}
    </fieldset>
  );

  return (
    <>
      <TopBar title={mission ? mission.title : "Guardar momento"} back={back} />
      <main className="main">
        {step.kind === "pick" ? (
          <section className="stack-lg">
            <h1 ref={headingRef} tabIndex={-1}>{mission ? "Escolha a foto" : "Guardar momentos"}</h1>
            {entryError ? <div className="notice notice--warn" role="alert"><IconAlert /><span>{entryError}</span></div> : null}
            {mission ? (
              <div className="card card--soft stack" style={{ gap: 4 }}>
                <span className="caption">O que precisa aparecer</span>
                <p style={{ fontWeight: 600 }}>{mission.criterion}</p>
              </div>
            ) : <p className="muted">Qualquer momento vale. Fotos antigas da galeria também — dá para escolher várias de uma vez.</p>}
            {room === 0 ? (
              <div className="notice notice--warn" role="alert"><IconAlert /><span>O diário chegou ao limite de {LIMITS.maxEntries} lembranças desta versão de teste. Nada foi apagado; para guardar novas, exclua alguma antiga.</span></div>
            ) : (
              <>
                <PhotoPicker onPicked={onPicked} onPickedMany={mission ? undefined : onPickedMany} maxFiles={room} />
                {!mission ? <p className="caption">Cabem mais {room} {room === 1 ? "lembrança" : "lembranças"} nesta versão de teste.</p> : null}
              </>
            )}
            {pickNotes.length ? (
              <div className="notice notice--warn" role="alert"><IconAlert /><span>{pickNotes.join(" · ")}</span></div>
            ) : null}
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
              {img.takenDate && img.takenDate <= snap.today ? <span className="hint">Data lida da própria foto. Ajuste se quiser.</span> : null}
            </div>
            {!mission ? albumPicker("Colocar em álbuns") : null}
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

        {step.kind === "batch" ? (
          <section className="stack-lg">
            <h1 ref={headingRef} tabIndex={-1}>{batch.length} fotos para guardar</h1>
            <p className="muted">Legenda e data são opcionais. A data vem da própria foto quando ela tiver; senão, fica a de hoje.</p>
            {pickNotes.length ? <div className="notice notice--warn" role="alert"><IconAlert /><span>{pickNotes.join(" · ")}</span></div> : null}
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Fotos escolhidas">
              {batch.map((item, i) => (
                <BatchRow
                  key={item.key}
                  item={item}
                  index={i}
                  today={snap.today}
                  disabled={busy || item.state === "saved"}
                  onChange={(patch) => setBatch((b) => b.map((x) => (x.key === item.key ? { ...x, ...patch, state: x.state === "error" ? "pending" : x.state } : x)))}
                  onRemove={() => setBatch((b) => b.filter((x) => x.key !== item.key))}
                />
              ))}
            </ul>
            {albumPicker("Colocar todas em álbuns")}
            <p className="caption">Se houver outras pessoas nas fotos, garanta que elas concordam antes de compartilhar.</p>
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <div className="stack">
              <button type="button" className="btn btn--primary btn--block" onClick={saveAll} disabled={busy || batch.length === 0}>
                {busy ? `Guardando ${batch.filter((x) => x.state === "saved").length + 1} de ${batch.length}…` : "Guardar todas"}
              </button>
              <Link href={back} className="btn btn--ghost btn--block">Cancelar</Link>
            </div>
          </section>
        ) : null}

        {step.kind === "batchDone" ? (
          <section className="stack-lg" aria-live="polite">
            <h1 ref={headingRef} tabIndex={-1}>{step.count} lembranças guardadas</h1>
            <p className="muted">Todas já estão no diário de {dog.name}. Se alguma combinar com uma missão, use “Usar numa missão” no Diário.</p>
            <div className="stack">
              <Link href="/diario" className="btn btn--primary btn--block">Ver no diário</Link>
              <Link href="/hoje" className="btn btn--secondary btn--block">Voltar para Hoje</Link>
            </div>
          </section>
        ) : null}

        {step.kind === "confirm" ? (
          <section className="stack-lg">
            <h1 ref={headingRef} tabIndex={-1}>A foto mostra isso?</h1>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Foto escolhida para a missão" className="photo" />
            ) : <div className="skeleton photo" aria-hidden="true" />}
            <div className="card card--soft stack" style={{ gap: 4 }}>
              <span className="caption">Critério</span>
              <p style={{ fontWeight: 600 }}>{mission!.criterion}</p>
            </div>
            {missionStateNow === "completed" ? (
              <div className="notice notice--info" role="status"><IconInfo /><span>Essa missão já foi concluída. A foto entra no álbum, mas os pontos não somam de novo.</span></div>
            ) : null}
            <div className="notice notice--info"><IconInfo /><span>Quem confirma é você. A foto já está guardada no diário.</span></div>
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

function BatchRow({
  item, index, today, disabled, onChange, onRemove,
}: {
  item: BatchItem;
  index: number;
  today: CivilDate;
  disabled: boolean;
  onChange: (patch: Partial<Pick<BatchItem, "caption" | "date">>) => void;
  onRemove: () => void;
}) {
  const url = useBlobUrl(item.img.thumb);
  const n = index + 1;
  return (
    <li className="card batch-row" style={{ padding: 12 }} aria-label={`Foto ${n}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt={`Foto ${n} escolhida`} className="batch-row__thumb" /> : <div className="skeleton batch-row__thumb" aria-hidden="true" />}
      <div className="stack" style={{ gap: 8, minWidth: 0, flex: 1 }}>
        <div className="field" style={{ gap: 4 }}>
          <label htmlFor={`cap-${item.key}`} className="small">Legenda da foto {n} <span className="muted">(opcional)</span></label>
          <input id={`cap-${item.key}`} className="input" value={item.caption} maxLength={LIMITS.captionMaxChars} onChange={(e) => onChange({ caption: e.target.value })} disabled={disabled} />
        </div>
        <div className="field" style={{ gap: 4 }}>
          <label htmlFor={`date-${item.key}`} className="small">Data da foto {n}</label>
          <input id={`date-${item.key}`} type="date" className="input" value={item.date} max={today} onChange={(e) => onChange({ date: e.target.value })} disabled={disabled} />
        </div>
        <div className="row-between">
          {item.state === "saved" ? (
            <span className="caption" role="status"><IconCheck size={14} style={{ verticalAlign: "-2px" }} /> Guardada</span>
          ) : item.state === "error" ? (
            <span className="field-error" role="alert">{item.message}</span>
          ) : <span />}
          {item.state !== "saved" ? (
            <button type="button" className="icon-btn" onClick={onRemove} disabled={disabled} aria-label={`Tirar a foto ${n} do lote`} style={{ color: "var(--danger)" }}><IconTrash /></button>
          ) : null}
        </div>
      </div>
    </li>
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
        <div style={{ position: "relative" }}>
          <div className={`polaroid tape${approved ? " anim-drop" : ""}`} style={{ margin: "8px 6px 0" }}><img src={previewUrl} alt={`Lembrança de ${dogName}`} className="photo" /><p className="polaroid__note">{dogName}</p></div>
          {approved ? <PawBurst /> : null}
        </div>
      ) : null}
      {approved ? (
        <>
          <div className="stack">
            <span className="chip chip--reward anim-stamp" style={{ alignSelf: "flex-start" }}><IconStar size={16} /> {r!.xpAwarded > 0 ? `+${r!.xpAwarded} XP` : "Pontos já contados"}</span>
            <h1 ref={headingRef} tabIndex={-1}>Conquista: {missionTitle}</h1>
            <p className="muted">{r!.alreadyCompleted ? "Essa missão já estava concluída — a foto foi guardada e os pontos não somam de novo." : `Guardada no álbum ${collectionTitle(collectionOf(r!.submission.missionId))}.`}</p>
            <p className="caption"><IconCheck size={14} style={{ verticalAlign: "-2px" }} /> Confirmada por você</p>
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
          <p>Tudo bem não ter certeza. A foto ficou no diário, sem pontos — você pode tentar outra quando quiser.</p>
          <div className="stack">
            <Link href={`/guardar?missao=${slugFor(r.submission.missionId)}`} className="btn btn--primary btn--block">Tentar outra foto</Link>
            <Link href="/diario" className="btn btn--secondary btn--block">Ver no diário</Link>
          </div>
        </>
      ) : (
        <>
          <h1 ref={headingRef} tabIndex={-1}>Guardada no diário</h1>
          <p className="muted">Mais uma lembrança de {dogName}.</p>
          <div className="stack">
            <Link href="/diario" className="btn btn--primary btn--block">Ver no diário</Link>
            <Link href="/hoje" className="btn btn--secondary btn--block">Voltar para Hoje</Link>
          </div>
        </>
      )}
    </section>
  );
}

/** Patinhas que saltam da foto ao conquistar — decorativas; o texto confirma a conquista. */
function PawBurst() {
  const pieces = Array.from({ length: 10 }, (_, i) => {
    const ang = (i / 10) * Math.PI * 2;
    const dist = 120 + (i % 3) * 30;
    return { dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist * 0.8, rot: (i % 2 ? 1 : -1) * (30 + i * 9), delay: (i % 4) * 40 };
  });
  return (
    <div className="burst" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{ ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px`, ["--rot" as string]: `${p.rot}deg`, animationDelay: `${p.delay}ms`, color: i % 3 === 0 ? "var(--lilac)" : i % 3 === 1 ? "var(--accent)" : "var(--brand-teal)" }}>
          <Paw size={22} />
        </span>
      ))}
    </div>
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
