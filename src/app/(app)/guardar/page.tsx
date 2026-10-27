"use client";

import { CreditEarned } from "@/components/xp-reward";
import { CreditCelebration, bumpCachedBalance, markCelebrationSeen } from "@/components/credit-celebration";
import { useTranslations } from "next-intl";
import { useCatalog } from "@/i18n/catalog";
import { useFormat, usePrefs } from "@/i18n/use-format";
import { useErrorText } from "@/i18n/use-error";
import { loose } from "@/i18n/keys";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cycleContext, useBlobUrl, useMediaBlob, useStore } from "@/data/store";
import { DomainError, newId, type ProcessedImage, type SubmitResult } from "@/data/demo-repository";
import type { CollectionId } from "@/config/catalog";
import { AlbumChecklist } from "@/components/album-picker";
import { LIMITS, fullDiaryParams } from "@/config/business";
import { isCivilDate } from "@/domain/dates";
import { missionById, missionBySlug } from "@/domain/missions";
import { missionStatus } from "@/domain/cycle";
import { PawBurst } from "@/components/celebrate";
import type { CivilDate, DiaryEntry } from "@/domain/types";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { PhotoPicker, type PickFailure } from "@/components/photo-picker";
import { AbuMascot, AbuSays } from "@/components/brand";
import { MediaImage } from "@/components/media";
import { IconAlert, IconBrush, IconCheck, IconImage, IconInfo, IconRotate, IconStar, IconTrash } from "@/components/icons";
import { rotateProcessed } from "@/lib/image";
import { withSavedEntry, withSubmitResult } from "@/lib/snapshot-updates";

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
  // Data sugerida vinda de outra tela (ex.: “Guardar uma foto desta visita”).
  const presetDate = params.get("data");
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo, reload, patchDog } = useStore();
  const [answer, setAnswer] = useState(true); // resposta tocada na missão (só ela mostra que está indo)
  const [party, setParty] = useState(false); // 200 patinhas: comemoração
  const t = useTranslations("save");
  const te = useTranslations("errors");
  const tf = useTranslations("family");
  const cat = useCatalog(snap?.dog?.name ?? "");
  const f = useFormat();
  const { region } = usePrefs();
  const errText = useErrorText();

  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [img, setImg] = useState<ProcessedImage | null>(null);
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState("");
  const [albums, setAlbums] = useState<string[]>([]);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [pickNotes, setPickNotes] = useState<string[]>([]);
  const [dupe, setDupe] = useState<DiaryEntry | null>(null);
  const pickedHash = useRef<string | null>(null); // foto da conferência de duplicata em andamento
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entryKey = useRef<string>("");
  const submissionKey = useRef<string>("");
  /** Cachorro da operação: capturado ao escolher a foto; salvar, repetir e confirmar a missão vão sempre para ele. */
  const opDog = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Foto já guardada no diário (“Usar numa missão”): nada é enviado de novo.
  const existing = step.kind === "confirm" || step.kind === "result" ? step.entry : null;
  const existingDisplay = useMediaBlob(!img && existing ? existing.mediaId : null, "display");
  const previewUrl = useBlobUrl(img?.display ?? existingDisplay);

  const ctx = useMemo(() => (snap ? cycleContext(snap, region) : null), [snap, region]);
  const missionStateNow = mission && ctx ? missionStatus(mission, ctx) : null;
  const missionAvailable = missionStateNow === "available";

  useEffect(() => {
    if (snap && !date) setDate(presetDate && isCivilDate(presetDate) && presetDate <= snap.today ? presetDate : snap.today);
  }, [snap, date, presetDate]);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step.kind]);

  // ?missao=…&entrada=… → direto para a confirmação com a foto do diário.
  const [entryError, setEntryError] = useState<string | null>(null);
  useEffect(() => {
    if (!snap || !mission || !fromEntryId || step.kind !== "pick") return;
    const entry = snap.entries.find((e) => e.id === fromEntryId);
    if (!entry) return setEntryError(t("entry.notFound"));
    if (entry.source === "studio") return setEntryError(te("artNotAllowed"));
    if (entry.missionId && entry.missionId !== mission.id) return setEntryError(t("entry.usedElsewhere"));
    if (missionStateNow === "locked") return setEntryError(t("entry.locked", { first: cat.title("M01") }));
    if (missionStateNow === "not_today") return setEntryError(t("entry.notToday"));
    if (missionStateNow === "out_of_window") return setEntryError(t("entry.outOfWindow"));
    submissionKey.current = newId();
    opDog.current = snap.dog?.id ?? null;
    setStep({ kind: "confirm", entry });
  }, [snap, mission, fromEntryId, step.kind, missionStateNow, t, te, cat]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !repo) return <main className="main"><PageLoading /></main>;
  if (snap.role === "viewer") return (<><TopBar title={t("title")} back="/hoje" emoji="📸" /><main className="main"><p className="page-note">{t("viewer", { dog: snap.dog.name, role: tf("roles.editor") })}</p></main></>);
  const dog = snap.dog;
  const back = fromEntryId ? "/diario" : mission ? `/missoes/${mission.slug}` : "/diario";
  const room = Math.max(0, LIMITS.maxEntries - snap.entries.length);

  async function onPicked(p: ProcessedImage) {
    opDog.current = snap!.dog?.id ?? null;
    setImg(p);
    setError(null);
    setPickNotes([]);
    entryKey.current = newId(); // nova tentativa = nova chave; retries reutilizam
    setDate(p.takenDate && p.takenDate <= snap!.today ? p.takenDate : presetDate && isCivilDate(presetDate) && presetDate <= snap!.today ? presetDate : snap!.today);
    // A foto preparada aparece na hora; a conferência de duplicata roda em paralelo e só mostra o aviso se ainda
    // for a mesma foto (trocou de foto no meio: a resposta antiga é ignorada). Se falhar, segue sem o aviso.
    setDupe(null);
    setStep({ kind: "edit" });
    pickedHash.current = p.hash;
    void repo!.findEntryByHash(p.hash).then((d) => { if (pickedHash.current === p.hash) setDupe(d); }, () => undefined);
  }

  function onPickedMany(imgs: ProcessedImage[], failures: PickFailure[], skipped: number) {
    opDog.current = snap!.dog?.id ?? null;
    const notes = failures.map((x) => `${x.name}: ${x.message}`);
    if (skipped > 0) notes.push(t("skipped", { count: skipped, room }));
    setPickNotes(notes);
    setError(null);
    if (imgs.length === 0) return;
    if (imgs.length === 1) return void onPicked(imgs[0]);
    setBatch(imgs.map((p) => ({ key: newId(), img: p, caption: "", date: suggestedDate(p, snap!.today), state: "pending" })));
    setStep({ kind: "batch" });
  }

  /** Atualiza a tela sem reenviar nada; erro aqui não vira "não salvou". */
  const sync = () => reload().catch(() => undefined);

  async function save() {
    if (!img || busy) return;
    if (!isCivilDate(date) || date > snap!.today) {
      setError(te("dateUpToToday"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const albumIds = mission ? [] : albums;
      const entry = await repo!.saveEntry({
        requestKey: entryKey.current, image: img, caption, occurredDate: date,
        source: "free", missionId: null, albumIds, dogId: opDog.current,
      });
      // Já está salvo: entra no Diário e nos álbuns na hora; a conferência completa vai em segundo plano e, se
      // falhar, não desfaz o "guardada".
      patchDog(opDog.current, (s) => withSavedEntry(s, entry, albumIds));
      // Missão: a conferência completa vem depois da confirmação (uma recarga só, não duas seguidas).
      if (!(mission && missionAvailable)) void sync();
      if (mission && missionAvailable) {
        submissionKey.current = newId();
        setStep({ kind: "confirm", entry });
      } else {
        setStep({ kind: "result", entry, result: null });
      }
    } catch (err) {
      setError(errText(err instanceof DomainError ? err : null, "errors.savePhotoFailed"));
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
        next[i] = { ...item, state: "error", message: te("dateUpToToday") };
        continue;
      }
      try {
        const entry = await repo!.saveEntry({ requestKey: item.key, image: item.img, caption: item.caption, occurredDate: item.date, source: "free", missionId: null, albumIds: albums, dogId: opDog.current });
        patchDog(opDog.current, (s) => withSavedEntry(s, entry, albums));
        next[i] = { ...item, state: "saved", message: undefined };
      } catch (err) {
        next[i] = { ...item, state: "error", message: errText(err instanceof DomainError ? err : null, "errors.savePhotoFailed") };
      }
      setBatch([...next]);
    }
    setBatch(next);
    setBusy(false);
    void sync(); // as guardadas já entraram na tela; a conferência vai em segundo plano (falha não é falha de envio)
    const saved = next.filter((x) => x.state === "saved").length;
    if (saved === next.length) setStep({ kind: "batchDone", count: saved });
    else setError(t("batchPartial", { saved, total: next.length }));
  }

  async function confirm(entry: DiaryEntry, matches: boolean) {
    if (!mission || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await repo!.submitMission({
        requestKey: submissionKey.current, missionId: mission.id, entryId: entry.id,
        status: matches ? "approved" : "uncertain", reasonCode: matches ? "OWNER_CONFIRMED" : "OWNER_UNSURE",
        mode: "owner", providerVersion: null, dogId: opDog.current,
      });
      // Conclusão, XP, álbum da missão, medalhas e item de coleção entram na tela já (com o cachorro da operação).
      patchDog(opDog.current, (s) => withSubmitResult(s, entry.id, mission, result));
      setStep({ kind: "result", entry, result }); // o servidor confirmou: mostra já
      if (result.creditsEarned && opDog.current) {
        // Completou as 200 patinhas: o saldo do Estúdio já sobe neste aparelho e vem a comemoração (uma vez no mês).
        bumpCachedBalance(opDog.current, result.creditsEarned);
        markCelebrationSeen(opDog.current, snap!.today.slice(0, 7), !!snap?.me);
        setParty(true);
      }
      void sync();
    } catch (err) {
      setError(errText(err instanceof DomainError ? err : null, "save.confirmFailed"));
    } finally {
      setBusy(false);
    }
  }

  const albumPicker = (legend: string) => <AlbumChecklist legend={`${legend} ${t("optional")}`} value={albums} onChange={setAlbums} />;
  const criterion = mission ? cat.mission(mission).criterion : "";

  return (
    <>
      <TopBar title={mission ? cat.title(mission) : t("title")} back={back} emoji={mission ? undefined : "📸"} />
      <main className="main">
        {step.kind === "pick" ? (
          <section className="stack-lg">
            <div className="pick-hero">
              <AbuMascot width={86} />
              <h1 ref={headingRef} tabIndex={-1} className="pick-hero__title">{mission ? t("pickTitleMission") : t("pickTitle", { dog: snap.dog.name })}</h1>
            </div>
            {entryError ? <div className="notice notice--warn" role="alert"><IconAlert /><span>{entryError}</span></div> : null}
            {mission ? (
              <div className="card card--soft stack" style={{ gap: 4 }}>
                <span className="caption">{t("needsToShow")}</span>
                <p style={{ fontWeight: 600 }}>{criterion}</p>
              </div>
            ) : null}
            {room === 0 ? (
              <div className="notice notice--warn" role="alert"><IconAlert /><span>{te("fullDiary", fullDiaryParams(snap.dog.name))}</span></div>
            ) : (
              <>
                <PhotoPicker tiles onPicked={onPicked} onPickedMany={mission ? undefined : onPickedMany} maxFiles={room} />
                {/* Espaço restante só quando estiver acabando. */}
                {!mission && room <= 10 ? <p className="caption">{t("roomLeft", { count: room })}</p> : null}
              </>
            )}
            {pickNotes.length ? (
              <div className="notice notice--warn" role="alert"><IconAlert /><span>{pickNotes.join(" · ")}</span></div>
            ) : null}
            {!mission && snap.entries.length ? (
              <div className="pick-recent" aria-label={t("recent")}>
                <span className="caption">{t("recent")}</span>
                <div className="pick-recent__row">
                  {snap.entries.slice(0, 4).map((e, i) => (
                    <span key={e.id} className="pick-recent__pola" style={{ rotate: `${[-4, 3, -2, 4][i]}deg` }}><MediaImage id={e.mediaId} alt="" /></span>
                  ))}
                </div>
              </div>
            ) : null}
            <details className="tiny-details">
              <summary>{t("whichPhotos")}</summary>
              <p className="caption">{t("whichPhotosText", { mb: Math.round(LIMITS.maxUploadBytes / 1024 / 1024) })}</p>
            </details>
          </section>
        ) : null}

        {step.kind === "edit" && img ? (
          <section className="stack-lg">
            <h1 ref={headingRef} tabIndex={-1}>{t("editTitle")}</h1>
            <div className="stack">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {previewUrl ? <img src={previewUrl} alt={t("previewAlt")} className="photo" style={{ objectFit: "contain", background: "#f1efe9" }} /> : null}
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button type="button" className="btn btn--secondary btn--small" onClick={async () => setImg(await rotateProcessed(img))}><IconRotate /> {t("rotate")}</button>
                <button type="button" className="btn btn--secondary btn--small" onClick={() => { setImg(null); setStep({ kind: "pick" }); }}><IconImage /> {t("changePhoto")}</button>
              </div>
            </div>
            {dupe ? (
              <div className="notice notice--info"><IconInfo /><span>{t("dupe", { date: f.date(dupe.occurredDate, "numeric") })}</span></div>
            ) : null}
            <div className="field">
              <label htmlFor="caption">{t("caption")} <span className="muted">{t("optional")}</span></label>
              <textarea id="caption" className="textarea" value={caption} maxLength={LIMITS.captionMaxChars} onChange={(e) => setCaption(e.target.value)} placeholder={t("captionPlaceholder")} />
              <span className="hint">{caption.length}/{LIMITS.captionMaxChars}</span>
            </div>
            <div className="field">
              <label htmlFor="date">{t("when")}</label>
              <input id="date" type="date" className="input" value={date} max={snap.today} onChange={(e) => setDate(e.target.value)} />
              {img.takenDate && img.takenDate <= snap.today ? <span className="hint">{t("dateFromPhoto")}</span> : null}
            </div>
            {!mission ? albumPicker(t("putInAlbums")) : null}
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <div className="stack">
              <button type="button" className="btn btn--primary btn--block" onClick={save} disabled={busy} aria-busy={busy ? "true" : undefined}>
                {busy ? t("saving") : mission ? t("saveAndContinue") : t("savePhoto")}
              </button>
              <Link href={back} className="btn btn--ghost btn--block">{t("cancel")}</Link>
            </div>
          </section>
        ) : null}

        {step.kind === "batch" ? (
          <section className="stack-lg">
            <h1 ref={headingRef} tabIndex={-1}>{t("batchTitle", { count: batch.length })}</h1>
            <p className="page-note">{t("batchNote")}</p>
            {pickNotes.length ? <div className="notice notice--warn" role="alert"><IconAlert /><span>{pickNotes.join(" · ")}</span></div> : null}
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label={t("chosen")}>
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
            {albumPicker(t("putAllInAlbums"))}
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <div className="stack">
              <button type="button" className="btn btn--primary btn--block" onClick={saveAll} disabled={busy || batch.length === 0} aria-busy={busy ? "true" : undefined}>
                {busy ? t("savingN", { n: batch.filter((x) => x.state === "saved").length + 1, total: batch.length }) : t("saveAll")}
              </button>
              <Link href={back} className="btn btn--ghost btn--block">{t("cancel")}</Link>
            </div>
          </section>
        ) : null}

        {step.kind === "batchDone" ? (
          <section className="stack-lg" aria-live="polite">
            <h1 ref={headingRef} tabIndex={-1}>{t("batchDone", { count: step.count })}</h1>
            <p className="muted">{t("batchDoneText", { dog: dog.name })}</p>
            <div className="stack">
              <Link href="/diario" className="btn btn--primary btn--block">{t("seeInDiary")}</Link>
              <Link href="/hoje" className="btn btn--secondary btn--block">{t("backToday")}</Link>
            </div>
          </section>
        ) : null}

        {step.kind === "confirm" ? (
          <section className="stack-lg">
            <h1 ref={headingRef} tabIndex={-1}>{t("confirmTitle")}</h1>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={t("confirmAlt")} className="photo" />
            ) : <div className="skeleton photo" aria-hidden="true" />}
            <div className="card card--soft stack" style={{ gap: 4 }}>
              <span className="caption">{t("criterion")}</span>
              <p style={{ fontWeight: 600 }}>{criterion}</p>
            </div>
            {missionStateNow === "completed" ? (
              <div className="notice notice--info" role="status"><IconInfo /><span>{t("alreadyDone")}</span></div>
            ) : null}
            <div className="notice notice--info"><IconInfo /><span>{t("youConfirm")}</span></div>
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <div className="stack">
              <button type="button" className="btn btn--primary btn--block" onClick={() => { setAnswer(true); void confirm(step.entry, true); }} disabled={busy} aria-busy={busy && answer ? "true" : undefined}>{busy && answer ? t("finishing") : t("yes")}</button>
              <button type="button" className="btn btn--secondary btn--block" onClick={() => { setAnswer(false); void confirm(step.entry, false); }} disabled={busy} aria-busy={busy && !answer ? "true" : undefined}>{t("notSure")}</button>
            </div>
          </section>
        ) : null}

        {step.kind === "result" ? (
          <ResultView step={step} dogName={dog.name} missionTitle={mission ? cat.title(mission) : undefined} firstAchievement={snap.completions.length === 1 && !!step.result?.xpAwarded} previewUrl={previewUrl} headingRef={headingRef}
            dailyAllDone={!!mission && mission.kind === "daily" && !!snap.dailyPlan && Object.values(snap.dailyPlan.slots).every((id) => ctx && missionStatus(missionById(id)!, ctx) === "completed")} />
        ) : null}
        <CreditCelebration open={party} dogName={dog.name} onClose={() => setParty(false)} />
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
  const t = useTranslations("save");
  return (
    <li className="card batch-row" style={{ padding: 12 }} aria-label={t("photoN", { n })}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt={t("photoNAlt", { n })} className="batch-row__thumb" /> : <div className="skeleton batch-row__thumb" aria-hidden="true" />}
      <div className="stack" style={{ gap: 8, minWidth: 0, flex: 1 }}>
        <div className="field" style={{ gap: 4 }}>
          <label htmlFor={`cap-${item.key}`} className="small">{t("captionN", { n })} <span className="muted">{t("optional")}</span></label>
          <input id={`cap-${item.key}`} className="input" value={item.caption} maxLength={LIMITS.captionMaxChars} onChange={(e) => onChange({ caption: e.target.value })} disabled={disabled} />
        </div>
        <div className="field" style={{ gap: 4 }}>
          <label htmlFor={`date-${item.key}`} className="small">{t("dateN", { n })}</label>
          <input id={`date-${item.key}`} type="date" className="input" value={item.date} max={today} onChange={(e) => onChange({ date: e.target.value })} disabled={disabled} />
        </div>
        <div className="row-between">
          {item.state === "saved" ? (
            <span className="caption" role="status"><IconCheck size={14} style={{ verticalAlign: "-2px" }} /> {t("saved")}</span>
          ) : item.state === "error" ? (
            <span className="field-error" role="alert">{item.message}</span>
          ) : <span />}
          {item.state !== "saved" ? (
            <button type="button" className="icon-btn" onClick={onRemove} disabled={disabled} aria-label={t("removeN", { n })} style={{ color: "var(--danger)" }}><IconTrash /></button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function ResultView({
  step, dogName, missionTitle, firstAchievement, previewUrl, headingRef, dailyAllDone,
}: {
  dailyAllDone: boolean;
  step: Extract<Step, { kind: "result" }>;
  dogName: string;
  missionTitle?: string;
  firstAchievement: boolean;
  previewUrl: string | null;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const r = step.result;
  const t = useTranslations("save");
  const tl = loose(useTranslations());
  const cat = useCatalog(dogName);
  const approved = r?.submission.status === "approved";
  const m = r ? missionById(r.submission.missionId) : undefined;
  const theme = m?.studioTheme;
  const advanced = r?.advancedItem ? missionById(r.advancedItem) : undefined;
  return (
    <section className="stack-lg" aria-live="polite">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <div style={{ position: "relative" }}>
          <div className={`polaroid tape${approved ? " anim-drop" : ""}`} style={{ margin: "8px 6px 0" }}><img src={previewUrl} alt={t("memoryOf", { dog: dogName })} className="photo" /><p className="polaroid__note">{dogName}</p></div>
          {approved ? <PawBurst /> : null}
        </div>
      ) : null}
      {approved ? (
        <>
          <div className="stack">
            <span className="chip chip--reward anim-stamp" style={{ alignSelf: "flex-start" }}><IconStar size={16} /> {r!.xpAwarded > 0 ? t("plusPaws", { count: r!.xpAwarded }) : t("alreadyCounted")}</span>
            <h1 ref={headingRef} tabIndex={-1}>{t("achievement", { title: missionTitle ?? "" })}</h1>
            <p className="muted">{r!.alreadyCompleted ? t("alreadyCompleted") : t("savedInAlbum", { album: cat.collection(collectionOf(r!.submission.missionId)).title })}</p>
            <p className="caption"><IconCheck size={14} style={{ verticalAlign: "-2px" }} /> {t("confirmedByYou")}</p>
          </div>
          <CreditEarned n={r!.creditsEarned ?? 0} />
          {r!.medals.map((id) => (
            <div key={id} className="notice notice--positive" role="status">
              <span className="mission-stamp mission-stamp--done anim-stamp" aria-hidden="true" style={{ flex: "none" }}><IconStar /></span>
              <span>{t.rich("medal", { title: cat.set(id as Parameters<typeof cat.set>[0]).title, strong: (c) => <strong>{c}</strong> })}</span>
            </div>
          ))}
          {advanced ? <p className="small">{t("advanced", { title: cat.title(advanced) })}</p> : null}
          {dailyAllDone ? <p className="small">{t.rich("dailyAllDone", { strong: (c) => <strong>{c}</strong> })}</p> : null}
          {theme ? (
            <Link href={`/estudio?tema=${theme}&entrada=${step.entry.id}`} className="btn btn--secondary btn--block"><IconBrush /> {t("makeArt", { theme: tl(`studioCatalog.presets.${theme}.label`) })}</Link>
          ) : null}
          {firstAchievement ? <AbuSays>{t("abuFirst")}</AbuSays> : null}
          <div className="stack">
            <Link href={`/albuns/${collectionOf(r!.submission.missionId)}`} className="btn btn--primary btn--block">{t("openAlbum")}</Link>
            <Link href="/hoje" className="btn btn--secondary btn--block">{t("nextAdventure")}</Link>
          </div>
        </>
      ) : r ? (
        <>
          <h1 ref={headingRef} tabIndex={-1}>{t("savedInDiary")}</h1>
          <p>{t("unsureText")}</p>
          <div className="stack">
            <Link href={`/guardar?missao=${slugFor(r.submission.missionId)}`} className="btn btn--primary btn--block">{t("tryAnother")}</Link>
            <Link href="/diario" className="btn btn--secondary btn--block">{t("seeInDiary")}</Link>
          </div>
        </>
      ) : (
        <>
          <h1 ref={headingRef} tabIndex={-1}>{t("savedInDiary")}</h1>
          <p className="muted">{t("oneMore", { dog: dogName })}</p>
          <div className="stack">
            <Link href="/diario" className="btn btn--primary btn--block">{t("seeInDiary")}</Link>
            <Link href="/hoje" className="btn btn--secondary btn--block">{t("backToday")}</Link>
          </div>
        </>
      )}
    </section>
  );
}

function collectionOf(id: string): CollectionId {
  return missionById(id)?.collectionId ?? "primeiras-lembrancas";
}
function slugFor(id: string) {
  return missionById(id)?.slug ?? "";
}



export default function GuardarPage() {
  return (
    <Suspense fallback={<main className="main"><PageLoading /></main>}>
      <GuardarInner />
    </Suspense>
  );
}
