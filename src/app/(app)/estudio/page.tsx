"use client";

import { usePoll } from "@/lib/poll";
import { XP_MONTH_GOAL } from "@/config/credits";
import { LIMITS, fullDiaryParams } from "@/config/business";
import { Sheet } from "@/components/entry-actions";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { loose } from "@/i18n/keys";
import { usePrefs } from "@/i18n/use-format";
import { useErrorText } from "@/i18n/use-error";
import { isUpcoming, orderDatePresets } from "@/domain/calendar";
import {
  ILLUSTRATED_SUFFIX, SHOWCASE_PRESETS, STUDIO_TABS, presetById, type StudioAspect, type StudioCategory, type StudioPreset,
} from "@/config/studio";
import { DomainError } from "@/data/demo-repository";
import { useBlobUrl, useMediaBlob, useStore } from "@/data/store";
import { FAILURE_CODES, studioCheckPhoto, studioCreateJob, type PhotoCheck, studioJob, studioState, type StudioJob, type StudioOverlay, type StudioState } from "@/data/studio-client";
import { composeArt } from "@/lib/compose-art";
import { composeModeFor, saveComposite } from "@/lib/studio-composite";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { MediaImage } from "@/components/media";
import { IconBrush, IconCheck, IconDownload, IconInfo, IconStar, Paw } from "@/components/icons";

const CATEGORY_LOOK: Record<StudioCategory, { bg: string; fg: string }> = {
  datas: { bg: "linear-gradient(135deg, #ffd9bf, #fff1e6)", fg: "#a9461a" },
  estilos: { bg: "linear-gradient(135deg, #d3efea, #9adcd2)", fg: "#226760" },
  fantasias: { bg: "linear-gradient(135deg, #e9def3, #f6f0fa)", fg: "#6a4a86" },
  formatos: { bg: "linear-gradient(135deg, #fff8ec, #f1e6d2)", fg: "#3d2d1e" },
};

/** Vinheta decorativa do preset — “exemplo de estilo”, NÃO é prévia do resultado (briefing §21). */
/** Exemplo real do estilo, feito com o Abu (public/estudio/<id>.webp); sem exemplo, a vinheta de cor da aba. */
function PresetVignette({ preset }: { preset: StudioPreset }) {
  const look = CATEGORY_LOOK[preset.category];
  const [broken, setBroken] = useState(false);
  const t = useTranslations("studio");
  if (!broken) {
    return (
      <span className="preset-vignette preset-vignette--photo" style={{ background: look.bg }} aria-hidden="true">
        <img src={`/estudio/${preset.id}.webp`} alt="" loading="lazy" width={180} height={180} onError={() => setBroken(true)} />
        <span className="preset-vignette__tag">{t("exampleAbu")}</span>
      </span>
    );
  }
  return (
    <span className="preset-vignette" style={{ background: look.bg, color: look.fg }} aria-hidden="true">
      <IconBrush size={22} />
      <span className="preset-vignette__tag">{t("exampleStyle")}</span>
    </span>
  );
}

type Crop = { x: number; y: number; w: number; h: number };

/** Recorte manual (quando há mais de um cachorro): arraste o quadro sobre a foto. Coordenadas 0..1. */
function CropBox({ entryMediaId, value, onChange }: { entryMediaId: string; value: Crop; onChange: (v: Crop) => void }) {
  const name = useStore().snap?.dog?.name ?? "";
  const t = useTranslations("studio");
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const clamp = (v: number, max: number) => Math.min(Math.max(0, v), max);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div ref={ref} className="crop-area"
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, x: value.x, y: value.y }; }}
        onPointerMove={(e) => {
          if (!drag.current || !ref.current) return;
          const r = ref.current.getBoundingClientRect();
          onChange({ ...value, x: clamp(drag.current.x + (e.clientX - drag.current.px) / r.width, 1 - value.w), y: clamp(drag.current.y + (e.clientY - drag.current.py) / r.height, 1 - value.h) });
        }}
        onPointerUp={() => { drag.current = null; }}>
        <MediaImage id={entryMediaId} variant="display" alt={t("cropAlt")} className="crop-area__img" />
        <span className="crop-area__box" style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%`, width: `${value.w * 100}%`, height: `${value.h * 100}%` }} />
      </div>
      <label className="field" style={{ gap: 4 }}>
        <span className="small">{t("cropSize")}</span>
        <input type="range" min={30} max={100} value={Math.round(value.w * 100)}
          onChange={(e) => { const s = Number(e.target.value) / 100; onChange({ w: s, h: s, x: clamp(value.x, 1 - s), y: clamp(value.y, 1 - s) }); }} />
      </label>
      <p className="caption">{t("cropDrag", { dog: name })}</p>
    </div>
  );
}

function StudioEntryThumb({ entryId }: { entryId: string }) {
  const { snap } = useStore();
  const e = snap?.entries.find((x) => x.id === entryId);
  const t = useTranslations("studio");
  return e ? <MediaImage id={e.mediaId} variant="thumb" alt={t("original")} className="studio-art" /> : <div className="studio-art" style={{ display: "grid", placeItems: "center", background: "var(--brand-soft)", aspectRatio: "1" }}><span className="caption">{t("photoDeleted")}</span></div>;
}

/** Créditos com patinhas (disponíveis × usados) e barra de artes do dia. */
/** Dicas da foto: um link pequeno que abre a lista (não ocupa a tela toda vez). */
function PhotoTips({ dogName }: { dogName: string }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("studio.tips");
  const strong = { strong: (c: React.ReactNode) => <strong>{c}</strong> };
  return (
    <>
      <button type="button" className="sp-link tips-link" onClick={() => setOpen(true)}>{t("link")}</button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="tips-title">
        <h2 id="tips-title">{t("title")}</h2>
        <ol className="tips-list">
          {(["face", "light", "big", "sharp", "one"] as const).map((k) => <li key={k}>{t.rich(k, { ...strong, dog: dogName })}</li>)}
        </ol>
        <p className="caption">{t("check")}</p>
        <button type="button" className="btn btn--secondary btn--block" onClick={() => setOpen(false)}>{t("gotIt")}</button>
      </Sheet>
    </>
  );
}

/** Saldo numa linha: a compra fica discreta enquanto houver crédito; o limite do dia só aparece se for atingido. */
function CreditMeter({ state, dogName }: { state: StudioState; dogName: string }) {
  const out = state.balance <= 0;
  const dayFull = !!state.dailyLimit && state.dailyUsed >= state.dailyLimit;
  const t = useTranslations("studio.credits");
  return (
    <section className={`credit-line${out ? " credit-line--out" : ""}`} aria-label={t("label")}>
      {out ? (
        <>
          <p className="credit-line__text"><span aria-hidden="true">🎨</span> {t("out", { dog: dogName })}</p>
          <Link href="/estudio/creditos" className="btn btn--primary btn--small">{t("see")}</Link>
          <p className="caption" style={{ margin: 0 }}>{t("orEarn", { goal: XP_MONTH_GOAL })}</p>
        </>
      ) : (
        <>
          <div className="credit-line__top">
            <span className="credit-line__text">{t.rich("have", { count: state.balance, dog: dogName, strong: (c) => <strong>{c}</strong> })}</span>
            <Link href="/estudio/creditos" className="credit-line__buy">{t("buy")}</Link>
          </div>
          <div className="credit-meter__paws credit-line__paws" role="img" aria-label={t("count", { count: state.balance })}>
            {Array.from({ length: Math.min(state.balance, 12) }, (_, k) => (
              <span key={k} className="is-on" style={{ animationDelay: `${k * 70}ms` }}><Paw size={18} /></span>
            ))}
            {state.balance > 12 ? <span className="credit-meter__more">+{state.balance - 12}</span> : null}
          </div>
        </>
      )}
      {dayFull ? <p className="caption" style={{ margin: 0 }}>{t("dayFull", { count: state.dailyUsed })}</p> : null}
    </section>
  );
}

/** Frases da espera, em studio.making.l0…l5. */
const MAKING_LINES = 6;

/** Tela de espera: a foto vira o estilo escolhido, com mensagens e progresso estimado (~15 s por arte). */
function MakingArt({ job }: { job: StudioJob }) {
  const preset = presetById(job.presetId);
  const name = useStore().snap?.dog?.name ?? "";
  const t = useTranslations("studio.making");
  const label = usePresetLabel();
  const [secs, setSecs] = useState(() => Math.max(0, Math.round((Date.now() - Date.parse(job.createdAt)) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const expected = preset?.premium ? 25 : preset?.post === "wallpaper" ? 22 : 16;
  const pct = Math.min(94, Math.round(100 * (1 - Math.exp(-secs / (expected * 0.75)))));
  const line = loose(t)(`l${Math.min(MAKING_LINES - 1, Math.floor(secs / 4))}`, { dog: name });
  return (
    <section className="making" aria-live="polite">
      <div className="making__stage" aria-hidden="true">
        <div className="making__frame making__frame--photo">{job.inputEntryId ? <StudioEntryThumb entryId={job.inputEntryId} /> : null}</div>
        <span className="making__wand"><IconBrush size={22} /></span>
        <div className="making__frame making__frame--art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/estudio/${job.presetId}.webp`} alt="" />
          <span className="making__shine" />
        </div>
      </div>
      <h2 className="making__title">{t("title", { theme: label(job.presetId), dog: name })}</h2>
      <p className="making__line" key={line}>{line}</p>
      <div className="making__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t("progress")}><span style={{ width: `${pct}%` }} /></div>
      <p className="making__meta">{t("meta", { secs, expected })}</p>
      <p className="caption" style={{ textAlign: "center" }}>{t("leave")}</p>
    </section>
  );
}

/** Resultado com a foto original ao lado, selo de IA e texto desenhado pelo app. */
function StudioResult({ job, onAgain }: { job: StudioJob; onAgain: () => void }) {
  const studioAlbum = useStore().snap?.customAlbums.find((c) => c.systemKey === "studio");
  const t = useTranslations("studio.result");
  const label = usePresetLabel();
  const studioAlbumHref = studioAlbum ? `/albuns/${studioAlbum.id}` : "/diario";
  const preset = presetById(job.presetId);
  const art = useMediaBlob(job.outputMediaId, "display");
  const { repo, reload } = useStore();
  const [composed, setComposed] = useState<Blob | null>(null);
  const mode = composeModeFor(job.presetId);
  useEffect(() => {
    let alive = true;
    if (art) composeArt(art, job.overlay, mode).then((b) => alive && setComposed(b), () => alive && setComposed(art));
    return () => {
      alive = false;
    };
  }, [art, job.overlay, mode]);
  // A composta (com nome/mensagem) vira a imagem da lembrança: Diário, álbum e link mostram o mesmo que aqui.
  useEffect(() => {
    if (!composed || composed === art || !repo) return;
    void saveComposite(job, () => repo.getMediaBlob(job.outputMediaId!, "display"), composed).then(() => reload().catch(() => undefined), () => undefined);
  }, [composed, art, job, repo, reload]);
  const url = useBlobUrl(composed);
  const sticker = preset?.post === "sticker";
  const download = () => {
    if (!composed || !url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `diario-de-patas-${job.presetId}.${composed.type === "image/png" ? "png" : "webp"}`; // nome do arquivo igual nos dois idiomas
    a.click();
  };
  return (
    <section className="stack-lg" aria-live="polite">
      <div className="studio-compare">
        <figure className="stack" style={{ margin: 0, gap: 4 }}>
          {job.inputEntryId ? <StudioEntryThumb entryId={job.inputEntryId} /> : null}
          <figcaption className="caption">{t("original")}</figcaption>
        </figure>
        <figure className="stack" style={{ margin: 0, gap: 4 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt={t("alt", { theme: label(job.presetId) })} className={`studio-art${sticker ? " studio-art--sticker" : ""}`} /> : <div className="skeleton studio-art" style={{ aspectRatio: "1" }} aria-hidden="true" />}
          <figcaption><span className="chip chip--accent">{t("chip")}</span></figcaption>
        </figure>
      </div>
      <p className="small muted">{t("unique")}</p>
      {sticker ? (
        <div className="notice notice--info small"><IconInfo size={18} /><span>{t("sticker")}</span></div>
      ) : null}
      <div className="stack">
        <button type="button" className="btn btn--primary btn--block" onClick={download} disabled={!url}><IconDownload /> {sticker ? t("downloadSticker") : t("download")}</button>
        <button type="button" className="btn btn--secondary btn--block" onClick={onAgain}>{t("again")}</button>
        <Link href={studioAlbumHref} className="btn btn--secondary btn--block">{t("seeAlbum")}</Link>
      </div>
    </section>
  );
}

function PhotoCheckNote({ check }: { check: PhotoCheck | "checking" | null }) {
  const name = useStore().snap?.dog?.name ?? "";
  const t = useTranslations("studio.check");
  const ti = loose(useTranslations("studio.issues"));
  if (!check) return null;
  if (check === "checking") return <p className="caption" role="status">{t("checking")}</p>;
  if (check.verdict === "good") return <p className="notice notice--positive small" role="status"><span>{t("good", { dog: name })}</span></p>;
  if (!check.aiChecked && check.issues.length === 0) {
    return <p className="notice notice--warn small" role="status"><span>{t("unchecked", { dog: name })}</span></p>;
  }
  const bad = check.verdict === "bad";
  return (
    <div className={`notice ${bad ? "notice--error" : "notice--warn"} small`} role="status">
      <span>
        <strong>{bad ? t("badTitle") : t("warnTitle")}</strong>
        <ul style={{ margin: "4px 0 0", paddingLeft: "1.1em" }}>{check.issues.map((i) => <li key={i.code}>{ti.has(i.code) ? ti(i.code, { dog: name }) : t("generic")}</li>)}</ul>
        {bad ? t("badNext") : t("warnNext")}
        {!check.aiChecked ? <><br />{t("notConfirmed", { dog: name })}</> : null}
      </span>
    </div>
  );
}

/** Nome do tema no idioma da pessoa (a variante ilustrada usa o nome do tema original). */
function usePresetLabel() {
  const tl = loose(useTranslations("studioCatalog"));
  return useCallback((id: string) => {
    const base = presetById(id)?.variantOf ?? id;
    return tl.has(`presets.${base}.label`) ? tl(`presets.${base}.label`) : id;
  }, [tl]);
}

function Estudio() {
  const { ready, snap, unavailable } = useRequireDiary();
  const params = useSearchParams();
  const t = useTranslations("studio");
  const tc = loose(useTranslations("studioCatalog"));
  const label = usePresetLabel();
  const errText = useErrorText();
  const { region } = usePrefs();
  const [state, setState] = useState<StudioState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const presetFromUrl = presetById(params.get("tema") ?? "");
  const [tab, setTab] = useState<StudioCategory>(presetFromUrl?.category ?? "datas");
  const [presetId, setPresetId] = useState<string | null>(presetFromUrl?.id ?? null);
  // Datas: a mesma ideia em foto realista ou em ilustração (cada uma com o seu exemplo).
  const [look, setLook] = useState<"realista" | "ilustracao">(presetFromUrl?.variantOf ? "ilustracao" : "realista");
  const shownId = (p: StudioPreset) => (look === "ilustracao" && p.illustration ? p.id + ILLUSTRATED_SUFFIX : p.id);
  // Abas com os dois acabamentos: tema de estilo único (figurinha) aparece só em "Ilustração".
  const hasLooks = SHOWCASE_PRESETS.some((p) => p.category === tab && p.illustration);
  function changeLook(next: "realista" | "ilustracao") {
    setLook(next);
    const cur = presetId ? presetById(presetId) : undefined;
    const base = cur ? presetById(cur.variantOf ?? cur.id) : undefined;
    if (base?.illustration) setPresetId(next === "ilustracao" ? base.id + ILLUSTRATED_SUFFIX : base.id);
    // Tema de estilo único (figurinha) só existe em "Ilustração": ao trocar para "Realista", sai da seleção
    // (antes ficava escolhido, escondido da lista, e a arte seria criada com ele).
    else if (base && hasLooks && next === "realista") setPresetId(null);
  }
  const [photoId, setPhotoId] = useState<string | null>(params.get("entrada"));
  const [aspect, setAspect] = useState<StudioAspect | null>(null);
  const [cropOn, setCropOn] = useState(false);
  const [crop, setCrop] = useState<Crop>({ x: 0.15, y: 0.1, w: 0.7, h: 0.7 });
  const [overlay, setOverlay] = useState<StudioOverlay>({ frame: "simples" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<StudioJob | null>(null);
  const idem = useRef<string>("");
  const [photoCheck, setPhotoCheck] = useState<PhotoCheck | "checking" | null>(null);

  // Mostra na hora o último saldo conhecido deste diário; o servidor confirma logo em seguida.
  const cacheKey = `ddp-studio-${snap?.dog?.id ?? ""}`;
  useEffect(() => {
    if (!snap?.dog?.id) return;
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) setState((s) => s ?? (JSON.parse(saved) as StudioState));
    } catch { /* sem armazenamento: só espera o servidor */ }
  }, [cacheKey, snap?.dog?.id]);

  // Arte pronta (aqui ou em segundo plano) que o Diário/álbuns ainda não têm: atualiza o app todo, sem
  // precisar fechar e abrir. Só quando falta mesmo (evita recarregar à toa a cada consulta).
  const { reload: reloadStore } = useStore();
  const entriesRef = useRef<Set<string>>(new Set());
  entriesRef.current = new Set((snap?.entries ?? []).map((e) => e.id));
  const refresh = useCallback(async () => {
    try {
      const fresh = await studioState();
      setState(fresh);
      if (fresh.jobs.some((j) => j.state === "succeeded" && j.outputEntryId && !entriesRef.current.has(j.outputEntryId))) void reloadStore().catch(() => undefined);
      // Sem a lista de artes: um job antigo "em andamento" no cache abriria a tela de espera à toa.
      try { localStorage.setItem(cacheKey, JSON.stringify({ ...fresh, jobs: [] })); } catch { /* ok */ }
    } catch (e) {
      setLoadError(errText(e instanceof DomainError ? e : null, "studio.loadFailed"));
    }
  }, [cacheKey, reloadStore, errText]);
  useEffect(() => {
    idem.current = crypto.randomUUID();
    if (snap?.dog?.id) void refresh();
  }, [refresh, snap?.dog?.id]);

  // Reabrir a tela recupera o job em andamento (§9.2).
  useEffect(() => {
    if (!current && state) {
      const pending = state.jobs.find((j) => j.state === "queued" || j.state === "processing");
      if (pending) setCurrent(pending);
    }
  }, [state, current]);

  // Acompanha o job até terminar (a geração continua no servidor mesmo se a tela fechar).
  // Uma consulta por vez (sem acúmulo em internet lenta); pausa com a tela escondida.
  usePoll(async () => {
    if (!current) return true;
    const j = await studioJob(current.id);
    if (j.state !== current.state) setCurrent(j);
    const done = !["queued", "processing"].includes(j.state);
    if (done) void refresh();
    return done;
  }, 3000, !!current && ["queued", "processing"].includes(current.state));

  // Valida a foto (e o recorte) antes de gastar crédito: foto ruim dá arte ruim.
  useEffect(() => {
    if (!photoId) return setPhotoCheck(null);
    setPhotoCheck("checking");
    let alive = true;
    const t = setTimeout(() => {
      studioCheckPhoto({ entryId: photoId, crop: cropOn ? crop : null })
        .then((c) => { if (alive) setPhotoCheck(c); })
        .catch(() => { if (alive) setPhotoCheck(null); });
    }, cropOn ? 700 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [photoId, cropOn, crop]);

  const preset = presetId ? presetById(presetId) : undefined;
  const flags = useMemo(() => new Map((state?.presets ?? []).map((p) => [p.id, p])), [state]);
  const photos = useMemo(() => (snap?.entries ?? []).filter((e) => e.source !== "studio"), [snap]);
  const dogName = snap?.dog?.name ?? "";

  // Mensagem pronta no idioma da pessoa. Se ela editar, o texto dela fica (inclusive ao trocar de idioma).
  const hintBase = preset ? preset.variantOf ?? preset.id : null;
  const hint = hintBase && tc.has(`presets.${hintBase}.hint`) ? tc(`presets.${hintBase}.hint`) : "";
  const [editedMsg, setEditedMsg] = useState<string | null>(null);
  const message = editedMsg ?? hint;
  useEffect(() => {
    if (preset) {
      setAspect(preset.aspect);
      setEditedMsg(null);
      setOverlay((o) => ({ ...o, name: o.name || dogName }));
    }
  }, [preset, dogName]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;

  const credits = preset ? flags.get(preset.id)?.credits ?? preset.credits : 0;
  const photo = photos.find((p) => p.id === photoId);
  const full = snap ? snap.entries.length >= LIMITS.maxEntries : false;
  const canCreate = !full && (!!state?.available && !!preset && !!photo && (flags.get(preset.id)?.enabled ?? true) && (state?.balance ?? 0) >= credits && !busy && photoCheck !== "checking" && !(photoCheck && photoCheck.verdict === "bad"));

  async function create() {
    if (!canCreate || !preset || !photo) return;
    setBusy(true);
    setError(null);
    try {
      const job = await studioCreateJob({
        entryId: photo.id, presetId: preset.id, aspect: aspect ?? preset.aspect, idempotencyKey: idem.current,
        crop: cropOn ? crop : null, overlay: preset.addTextOverlay ? { ...overlay, message } : null,
      });
      setCurrent(job);
      void refresh();
    } catch (e) {
      setError(errText(e instanceof DomainError ? e : null, "errors.startArtFailed"));
    } finally {
      setBusy(false);
    }
  }

  function again() {
    idem.current = crypto.randomUUID(); // nova variação = novo pedido (e novo crédito)
    setCurrent(null);
  }

  return (
    <>
      <TopBar title={t("title")} emoji="🎨" />
      <main className="main">
        <div className="stack">
          <h1 className="studio-title">{t("heading", { dog: snap.dog.name })} <Paw size={26} className="studio-title__paw" /></h1>
          <p className="page-note">{t("note", { dog: snap.dog.name })}</p>
        </div>

        {loadError ? (
          <p className="field-error" role="alert">{loadError}</p>
        ) : state && !state.configured ? (
          <div className="notice notice--info"><IconInfo /><span>{t.rich("almostReady", { strong: (c) => <strong>{c}</strong> })}</span></div>
        ) : state?.paused ? (
          <div className="notice notice--warn"><IconInfo /><span>{t("paused")}</span></div>
        ) : state ? (
          <>
            <CreditMeter state={state} dogName={snap.dog.name} />
          </>
        ) : null}

        {current && ["queued", "processing"].includes(current.state) ? (
          <MakingArt key={current.id} job={current} />
        ) : current?.state === "succeeded" ? (
          <StudioResult job={current} onAgain={again} />
        ) : current && ["failed", "cancelled"].includes(current.state) ? (
          <section className="notice notice--warn stack" role="alert">
            <span>{t(`failures.${(FAILURE_CODES as readonly string[]).includes(current.failureCode ?? "") ? (current.failureCode as (typeof FAILURE_CODES)[number]) : "TECHNICAL"}`, { dog: snap.dog.name })}</span>
            <button type="button" className="btn btn--secondary btn--small" onClick={again}>{t("retry")}</button>
          </section>
        ) : (
          <>
            <section className="stack" aria-labelledby="st-foto">
              <div className="row-between" style={{ alignItems: "baseline", gap: 8 }}>
                <h2 id="st-foto">{t("pickPhoto")}</h2>
                {photos.length ? <PhotoTips dogName={snap.dog.name} /> : null}
              </div>
              {photos.length === 0 ? (
                <Link href="/guardar" className="btn btn--secondary btn--block">{t("saveFirst", { dog: snap.dog.name })}</Link>
              ) : (
                <div className="photo-strip" role="radiogroup" aria-label={t("photos")}>
                  {photos.slice(0, 24).map((e) => (
                    <button key={e.id} type="button" role="radio" aria-checked={photoId === e.id} className={`photo-strip__item${photoId === e.id ? " is-selected" : ""}`} onClick={() => { setPhotoId(e.id); setCropOn(false); }} aria-label={e.caption ? t("photoCaption", { caption: e.caption }) : t("photoDate", { date: e.occurredDate })}>
                      <MediaImage id={e.mediaId} alt="" />
                    </button>
                  ))}
                </div>
              )}
              {photo ? (
                <label className="check"><input type="checkbox" checked={cropOn} onChange={(e) => setCropOn(e.target.checked)} /><span>{t("crop", { dog: snap.dog.name })}</span></label>
              ) : null}
              {photo && cropOn ? <CropBox entryMediaId={photo.mediaId} value={crop} onChange={setCrop} /> : null}
              {photo ? <PhotoCheckNote check={photoCheck} /> : null}
            </section>

            <section className="stack" aria-labelledby="st-tema">
              <h2 id="st-tema">{t("pickTheme")}</h2>
              <div role="tablist" aria-label={t("types")} className="tabs">
                {STUDIO_TABS.map((t) => (
                  <button key={t.id} type="button" role="tab" id={`st-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`st-panel-${t.id}`} className={`tab${tab === t.id ? " is-active" : ""}`} onClick={() => setTab(t.id)}>{tc(`tabs.${t.id}`)}</button>
                ))}
              </div>
              {hasLooks ? (
                <div role="radiogroup" aria-label={t("finish")} className="filter-row">
                  {([["realista", t("realistic")], ["ilustracao", t("illustration")]] as const).map(([id, label]) => (
                    <button key={id} type="button" role="radio" aria-checked={look === id} className={`filter-chip${look === id ? " is-active" : ""}`} onClick={() => changeLook(id)}>{label}</button>
                  ))}
                </div>
              ) : null}
              <div role="tabpanel" id={`st-panel-${tab}`} aria-labelledby={`st-tab-${tab}`} className="preset-grid">
                {(tab === "datas" ? orderDatePresets(SHOWCASE_PRESETS.filter((p) => p.category === "datas"), region, snap.today) : SHOWCASE_PRESETS.filter((p) => p.category === tab)).filter((p) => !hasLooks || p.illustration || look === "ilustracao").map((base) => presetById(shownId(base))!).filter((p) => flags.get(p.id)?.enabled ?? true).map((p) => {
                  const c = flags.get(p.id)?.credits ?? p.credits;
                  // Datas: "em breve" para as da região da pessoa que estão chegando; as de outra região dizem de onde são.
                  const tag = p.category === "datas" ? (p.region && p.region !== region ? t(`regionTag.${p.region}`) : isUpcoming(p, region, snap.today) ? t("soon") : null) : null;
                  return (
                    <button key={p.id} type="button" className={`preset-card${presetId === p.id ? " is-selected" : ""}`} aria-pressed={presetId === p.id} onClick={() => setPresetId(p.id)}>
                      <PresetVignette preset={p} />
                      <strong>{label(p.id)}</strong>
                      <span className="caption">{t("creditsN", { count: c })}{p.premium ? " · premium" : ""}{tag ? ` · ${tag}` : ""}</span>
                    </button>
                  );
                })}
              </div>
              {preset && (preset.aspects.length > 1 || preset.addTextOverlay || preset.post === "card") ? (
                <div className="stack studio-details" aria-label={t("details", { theme: label(preset.id) })}>
                {preset.aspects.length > 1 ? (
                  <div role="radiogroup" aria-label={t("aspect")} className="filter-row filter-row--wrap">
                    {preset.aspects.map((a) => (
                      <button key={a} type="button" role="radio" aria-checked={(aspect ?? preset.aspect) === a} className={`filter-chip${(aspect ?? preset.aspect) === a ? " is-active" : ""}`} onClick={() => setAspect(a)}>
                        {tc(`formats.${a}`)} ({a})
                      </button>
                    ))}
                  </div>
                ) : null}
                {preset.addTextOverlay ? (
                  <>
                    <div className="field"><label htmlFor="st-msg">{t("message")} <span className="muted">{t("messageHint")}</span></label><input id="st-msg" className="input" maxLength={80} value={message} onChange={(e) => setEditedMsg(e.target.value)} /></div>
                    <div className="field"><label htmlFor="st-nome">{t("name")}</label><input id="st-nome" className="input" maxLength={40} value={overlay.name ?? ""} onChange={(e) => setOverlay({ ...overlay, name: e.target.value })} /></div>
                  </>
                ) : null}
                {preset.post === "card" ? (
                  <div role="radiogroup" aria-label={t("frame")} className="filter-row filter-row--wrap">
                    {(["simples", "patinhas", "festa"] as const).map((f) => (
                      <button key={f} type="button" role="radio" aria-checked={overlay.frame === f} className={`filter-chip${overlay.frame === f ? " is-active" : ""}`} onClick={() => setOverlay({ ...overlay, frame: f })}>
                        {tc(`frames.${f}`)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              ) : null}
            </section>

            <section className="card stack" aria-labelledby="st-custo">
              {full ? <p className="notice notice--warn small" role="alert" style={{ margin: 0 }}><span>{errText(`errors.fullDiaryNoCredit?${new URLSearchParams(Object.entries(fullDiaryParams(snap.dog.name)).map(([k, v]) => [k, String(v)]))}`)}</span></p> : null}
              <h2 id="st-custo" className="sr-only">{t("create")}</h2>
              {preset ? <p className="small" style={{ margin: 0 }}>{t("creditsN", { count: credits })}{state ? <> · {t("youHave", { n: state.balance })}</> : null}. {t("refund")}</p> : null}
              {error ? <p className="field-error" role="alert">{error}</p> : null}
              <button type="button" className="btn btn--primary btn--block" onClick={create} disabled={!canCreate}>
                <IconBrush /> {busy ? t("starting") : preset ? t("createWith", { count: credits }) : t("create")}
              </button>
              {state && preset && state.balance < credits ? <p className="small">{t("outOfCredits")} <Link href="/estudio/creditos">{t("seeCredits")}</Link></p> : null}
            </section>
          </>
        )}

        {state && state.jobs.some((j) => j.state === "succeeded") ? (
          <section className="stack" aria-labelledby="st-hist">
            <h2 id="st-hist">{t("history")}</h2>
            <ul className="preset-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {state.jobs.filter((j) => j.state === "succeeded" && j.outputMediaId).map((j) => (
                <li key={j.id}>
                  <button type="button" className="preset-card" onClick={() => setCurrent(j)} aria-label={t("openArt", { theme: label(j.presetId) })}>
                    <MediaImage id={j.outputMediaId} alt="" className="studio-history__img" />
                    <span className="caption">{label(j.presetId)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}

export default function EstudioPage() {
  return (
    <Suspense fallback={<main className="main"><PageLoading /></main>}>
      <Estudio />
    </Suspense>
  );
}
