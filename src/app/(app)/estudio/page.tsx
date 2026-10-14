"use client";

import { XpRewardBar } from "@/components/xp-reward";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  STUDIO_FORMATS, STUDIO_PRESETS, STUDIO_TABS, estimateCostUsd, presetById, type StudioAspect, type StudioCategory, type StudioPreset,
} from "@/config/studio";
import { REAL_MODE } from "@/config/mode";
import { DomainError } from "@/data/demo-repository";
import { useBlobUrl, useMediaBlob, useStore } from "@/data/store";
import { FAILURE_PT, studioCheckPhoto, studioCreateJob, type PhotoCheck, studioJob, studioState, type StudioJob, type StudioOverlay, type StudioState } from "@/data/studio-client";
import { composeArt } from "@/lib/compose-art";
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
  if (!broken) {
    return (
      <span className="preset-vignette preset-vignette--photo" style={{ background: look.bg }} aria-hidden="true">
        <img src={`/estudio/${preset.id}.webp`} alt="" loading="lazy" width={180} height={180} onError={() => setBroken(true)} />
        <span className="preset-vignette__tag">exemplo com o Abu</span>
      </span>
    );
  }
  return (
    <span className="preset-vignette" style={{ background: look.bg, color: look.fg }} aria-hidden="true">
      <IconBrush size={22} />
      <span className="preset-vignette__tag">exemplo de estilo</span>
    </span>
  );
}

type Crop = { x: number; y: number; w: number; h: number };

/** Recorte manual (quando há mais de um cachorro): arraste o quadro sobre a foto. Coordenadas 0..1. */
function CropBox({ entryMediaId, value, onChange }: { entryMediaId: string; value: Crop; onChange: (v: Crop) => void }) {
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
        <MediaImage id={entryMediaId} variant="display" alt="Foto escolhida para recortar" className="crop-area__img" />
        <span className="crop-area__box" style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%`, width: `${value.w * 100}%`, height: `${value.h * 100}%` }} />
      </div>
      <label className="field" style={{ gap: 4 }}>
        <span className="small">Tamanho do recorte</span>
        <input type="range" min={30} max={100} value={Math.round(value.w * 100)}
          onChange={(e) => { const s = Number(e.target.value) / 100; onChange({ w: s, h: s, x: clamp(value.x, 1 - s), y: clamp(value.y, 1 - s) }); }} />
      </label>
      <p className="caption">Arraste o quadro até o cachorro que vai virar arte.</p>
    </div>
  );
}

function StudioEntryThumb({ entryId }: { entryId: string }) {
  const { snap } = useStore();
  const e = snap?.entries.find((x) => x.id === entryId);
  return e ? <MediaImage id={e.mediaId} variant="thumb" alt="Foto original" className="studio-art" /> : <div className="studio-art" style={{ display: "grid", placeItems: "center", background: "var(--brand-soft)", aspectRatio: "1" }}><span className="caption">foto excluída</span></div>;
}

/** Créditos com patinhas (disponíveis × usados) e barra de artes do dia. */
function CreditMeter({ state }: { state: StudioState }) {
  const total = Math.max(state.creditsGranted ?? state.balance, state.balance);
  const used = Math.max(0, total - state.balance);
  const dayPct = state.dailyLimit ? Math.min(100, (state.dailyUsed / state.dailyLimit) * 100) : 0;
  return (
    <section className="credit-meter" aria-label="Seus créditos">
      <div className="credit-meter__top">
        <div>
          <span className="credit-meter__label">Seus créditos</span>
          <span className="credit-meter__big">{state.balance}<small> de {total}</small></span>
        </div>
        <span className="credit-meter__badge">{state.testCredits ? "teste · grátis" : "créditos"}</span>
      </div>
      <div className="credit-meter__paws" role="img" aria-label={`${state.balance} disponíveis, ${used} usados`}>
        {Array.from({ length: Math.min(total, 12) }, (_, i) => (
          <span key={i} className={i < state.balance ? "is-on" : ""} style={{ animationDelay: `${i * 70}ms` }}><Paw size={20} /></span>
        ))}
      </div>
      <p className="credit-meter__legend">{state.balance} {state.balance === 1 ? "disponível" : "disponíveis"} · {used} {used === 1 ? "usado" : "usados"}</p>
      <div className="credit-meter__day">
        <span>Hoje: {state.dailyUsed} de {state.dailyLimit} artes</span>
        <span className="credit-meter__bar" aria-hidden="true"><span style={{ width: `${dayPct}%` }} /></span>
      </div>
      <Link href="/estudio/creditos" className="credit-meter__buy"><Paw size={16} /> Comprar créditos</Link>
    </section>
  );
}

const MAKING_LINES = [
  "Olhando cada detalhe da foto…",
  "Escolhendo as cores do pelo…",
  "Caprichando nos bigodes…",
  "Desenhando as orelhas no lugar certo…",
  "Dando os últimos retoques…",
  "Quase pronta! Segura a ansiedade…",
];

/** Tela de espera: a foto vira o estilo escolhido, com mensagens e progresso estimado (~15 s por arte). */
function MakingArt({ job }: { job: StudioJob }) {
  const preset = presetById(job.presetId);
  const [secs, setSecs] = useState(() => Math.max(0, Math.round((Date.now() - Date.parse(job.createdAt)) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const expected = preset?.premium ? 25 : preset?.post === "wallpaper" ? 22 : 16;
  const pct = Math.min(94, Math.round(100 * (1 - Math.exp(-secs / (expected * 0.75)))));
  const line = MAKING_LINES[Math.min(MAKING_LINES.length - 1, Math.floor(secs / 4))];
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
      <h2 className="making__title">Criando “{preset?.labelPt}”</h2>
      <p className="making__line" key={line}>{line}</p>
      <div className="making__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progresso estimado"><span style={{ width: `${pct}%` }} /></div>
      <p className="making__meta">{secs} s · costuma levar uns {expected} segundos</p>
      <p className="caption" style={{ textAlign: "center" }}>Pode sair desta tela: a arte continua sendo feita e aparece aqui e no Diário.</p>
    </section>
  );
}

/** Resultado com a foto original ao lado, selo de IA e texto desenhado pelo app. */
function StudioResult({ job, onAgain }: { job: StudioJob; onAgain: () => void }) {
  const preset = presetById(job.presetId);
  const art = useMediaBlob(job.outputMediaId, "display");
  const [composed, setComposed] = useState<Blob | null>(null);
  const mode = preset?.post === "card" ? "card" : preset?.addTextOverlay ? "banner" : "none";
  useEffect(() => {
    let alive = true;
    if (art) composeArt(art, job.overlay, mode).then((b) => alive && setComposed(b), () => alive && setComposed(art));
    return () => {
      alive = false;
    };
  }, [art, job.overlay, mode]);
  const url = useBlobUrl(composed);
  const sticker = preset?.post === "sticker";
  const download = () => {
    if (!composed || !url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `diario-de-patas-${job.presetId}.${composed.type === "image/png" ? "png" : "webp"}`;
    a.click();
  };
  return (
    <section className="stack-lg" aria-live="polite">
      <div className="studio-compare">
        <figure className="stack" style={{ margin: 0, gap: 4 }}>
          {job.inputEntryId ? <StudioEntryThumb entryId={job.inputEntryId} /> : null}
          <figcaption className="caption">Foto original</figcaption>
        </figure>
        <figure className="stack" style={{ margin: 0, gap: 4 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt={`Arte ${preset?.labelPt ?? ""} criada com IA`} className={`studio-art${sticker ? " studio-art--sticker" : ""}`} /> : <div className="skeleton studio-art" style={{ aspectRatio: "1" }} aria-hidden="true" />}
          <figcaption><span className="chip chip--accent">Arte criada com IA</span></figcaption>
        </figure>
      </div>
      <p className="small muted">Uma interpretação artística da foto; alguns detalhes podem variar.</p>
      {sticker ? (
        <div className="notice notice--info small"><IconInfo size={18} /><span>Para usar no WhatsApp: baixe a figurinha (WebP 512×512 transparente) e adicione com um app de figurinhas, como o Sticker.ly. O Diário de Patas não acessa o seu WhatsApp.</span></div>
      ) : null}
      <div className="stack">
        <button type="button" className="btn btn--primary btn--block" onClick={download} disabled={!url}><IconDownload /> {sticker ? "Baixar figurinha" : "Baixar arte"}</button>
        <button type="button" className="btn btn--secondary btn--block" onClick={onAgain}>Gerar outra variação (novo crédito)</button>
        <Link href="/albuns/datas-especiais" className="btn btn--ghost btn--block">Ver em Datas especiais</Link>
      </div>
    </section>
  );
}

function PhotoCheckNote({ check }: { check: PhotoCheck | "checking" | null }) {
  if (!check) return null;
  if (check === "checking") return <p className="caption" role="status">Conferindo se a foto vai dar uma arte bonita…</p>;
  if (check.verdict === "good") return <p className="notice notice--positive small" role="status"><span>Foto boa para arte! 🐾</span></p>;
  if (!check.aiChecked && check.issues.length === 0) {
    return <p className="notice notice--warn small" role="status"><span>Não conseguimos conferir a foto agora. Confira se o cachorro aparece bem, de frente e com boa luz.</span></p>;
  }
  const bad = check.verdict === "bad";
  return (
    <div className={`notice ${bad ? "notice--error" : "notice--warn"} small`} role="status">
      <span>
        <strong>{bad ? "Essa foto não vai dar uma boa arte" : "A arte pode não ficar tão boa"}</strong>
        <ul style={{ margin: "4px 0 0", paddingLeft: "1.1em" }}>{check.issues.map((i) => <li key={i.code}>{i.message}</li>)}</ul>
        {bad ? <>Escolha outra foto ou use o recorte. Nenhum crédito foi usado.</> : <>Você pode seguir assim ou escolher outra foto.</>}
        {!check.aiChecked ? <><br />Não deu para confirmar se há um cachorro na foto.</> : null}
      </span>
    </div>
  );
}

function Estudio() {
  const { ready, snap, unavailable } = useRequireDiary();
  const params = useSearchParams();
  const [state, setState] = useState<StudioState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const presetFromUrl = presetById(params.get("tema") ?? "");
  const [tab, setTab] = useState<StudioCategory>(presetFromUrl?.category ?? "datas");
  const [presetId, setPresetId] = useState<string | null>(presetFromUrl?.id ?? null);
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

  const refresh = useCallback(async () => {
    if (!REAL_MODE) return;
    try {
      setState(await studioState());
    } catch (e) {
      setLoadError(e instanceof DomainError ? e.message : "Não conseguimos carregar o Estúdio.");
    }
  }, []);
  useEffect(() => {
    idem.current = crypto.randomUUID();
    void refresh();
  }, [refresh]);

  // Reabrir a tela recupera o job em andamento (§9.2).
  useEffect(() => {
    if (!current && state) {
      const pending = state.jobs.find((j) => j.state === "queued" || j.state === "processing");
      if (pending) setCurrent(pending);
    }
  }, [state, current]);

  // Acompanha o job até terminar (a geração continua no servidor mesmo se a tela fechar).
  useEffect(() => {
    if (!current || !["queued", "processing"].includes(current.state)) return;
    const t = setInterval(async () => {
      try {
        const j = await studioJob(current.id);
        if (j.state !== current.state) setCurrent(j);
        if (!["queued", "processing"].includes(j.state)) void refresh();
      } catch {
        /* tenta de novo no próximo intervalo */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [current, refresh]);

  // Valida a foto (e o recorte) antes de gastar crédito: foto ruim dá arte ruim.
  useEffect(() => {
    if (!REAL_MODE || !photoId) return setPhotoCheck(null);
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

  useEffect(() => {
    if (preset) {
      setAspect(preset.aspect);
      setOverlay((o) => ({ ...o, message: preset.overlayHint ?? "", name: o.name || dogName }));
    }
  }, [preset, dogName]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;

  const credits = preset ? flags.get(preset.id)?.credits ?? preset.credits : 0;
  const photo = photos.find((p) => p.id === photoId);
  const canCreate = REAL_MODE && !!state?.available && !!preset && !!photo && (flags.get(preset.id)?.enabled ?? true) && (state?.balance ?? 0) >= credits && !busy && photoCheck !== "checking" && !(photoCheck && photoCheck.verdict === "bad");

  async function create() {
    if (!canCreate || !preset || !photo) return;
    setBusy(true);
    setError(null);
    try {
      const job = await studioCreateJob({
        entryId: photo.id, presetId: preset.id, aspect: aspect ?? preset.aspect, idempotencyKey: idem.current,
        crop: cropOn ? crop : null, overlay: preset.addTextOverlay ? overlay : null,
      });
      setCurrent(job);
      void refresh();
    } catch (e) {
      setError(e instanceof DomainError ? e.message : "Não conseguimos começar a arte. Tente de novo.");
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
      <TopBar title="Estúdio" />
      <main className="main">
        <div className="stack">
          <h1 className="studio-title">Artes de {snap.dog.name} <Paw size={26} className="studio-title__paw" /></h1>
          <p className="muted">Transforme uma foto em arte de datas, estilos, fantasias ou formatos. A IA usa a foto como referência; nome e mensagem quem escreve é o app.</p>
        </div>

        {!REAL_MODE ? (
          <div className="notice notice--info" role="status"><IconInfo /><span><strong>Disponível com conta.</strong> As artes são geradas no servidor e usam créditos da conta — nesta versão de demonstração nada é gerado nem simulado. Explore os temas abaixo.</span></div>
        ) : loadError ? (
          <p className="field-error" role="alert">{loadError}</p>
        ) : state && !state.configured ? (
          <div className="notice notice--info"><IconInfo /><span><strong>Ainda não disponível.</strong> O provedor de artes está sendo configurado.</span></div>
        ) : state?.paused ? (
          <div className="notice notice--warn"><IconInfo /><span>A criação de artes está pausada no momento. O resto do diário segue normal.</span></div>
        ) : state ? (
          <>
            <CreditMeter state={state} />
            <XpRewardBar xpTotal={snap.xpTotal} compact />
          </>
        ) : null}

        {current && ["queued", "processing"].includes(current.state) ? (
          <MakingArt key={current.id} job={current} />
        ) : current?.state === "succeeded" ? (
          <StudioResult job={current} onAgain={again} />
        ) : current && ["failed", "cancelled"].includes(current.state) ? (
          <section className="notice notice--warn stack" role="alert">
            <span>{FAILURE_PT[current.failureCode ?? "TECHNICAL"] ?? FAILURE_PT.TECHNICAL}</span>
            <button type="button" className="btn btn--secondary btn--small" onClick={again}>Tentar de novo</button>
          </section>
        ) : (
          <>
            <section className="stack" aria-labelledby="st-foto">
              <h2 id="st-foto">1. Escolha a foto</h2>
              <p className="caption">Dica: rostinho de frente, boa luz e o cachorro bem visível. A foto é conferida antes de gastar crédito.</p>
              {photos.length === 0 ? (
                <div className="card stitched empty" style={{ boxShadow: "none" }}><p className="muted">Guarde uma foto no diário para criar a primeira arte.</p><Link href="/guardar" className="btn btn--secondary btn--small">Guardar momento</Link></div>
              ) : (
                <div className="photo-strip" role="radiogroup" aria-label="Fotos do diário">
                  {photos.slice(0, 24).map((e) => (
                    <button key={e.id} type="button" role="radio" aria-checked={photoId === e.id} className={`photo-strip__item${photoId === e.id ? " is-selected" : ""}`} onClick={() => { setPhotoId(e.id); setCropOn(false); }} aria-label={e.caption ? `Foto: ${e.caption}` : `Foto de ${e.occurredDate}`}>
                      <MediaImage id={e.mediaId} alt="" />
                    </button>
                  ))}
                </div>
              )}
              {photo ? (
                <label className="check"><input type="checkbox" checked={cropOn} onChange={(e) => setCropOn(e.target.checked)} /><span>Recortar a foto (aproximar o cachorro ou escolher um só)</span></label>
              ) : null}
              {photo && cropOn ? <CropBox entryMediaId={photo.mediaId} value={crop} onChange={setCrop} /> : null}
              {photo ? <PhotoCheckNote check={photoCheck} /> : null}
            </section>

            <section className="stack" aria-labelledby="st-tema">
              <h2 id="st-tema">2. Escolha o tema</h2>
              <div role="tablist" aria-label="Tipos de arte" className="tabs">
                {STUDIO_TABS.map((t) => (
                  <button key={t.id} type="button" role="tab" id={`st-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`st-panel-${t.id}`} className={`tab${tab === t.id ? " is-active" : ""}`} onClick={() => setTab(t.id)}>{t.labelPt}</button>
                ))}
              </div>
              <div role="tabpanel" id={`st-panel-${tab}`} aria-labelledby={`st-tab-${tab}`} className="preset-grid">
                {STUDIO_PRESETS.filter((p) => p.category === tab && (flags.get(p.id)?.enabled ?? true)).map((p) => {
                  const c = flags.get(p.id)?.credits ?? p.credits;
                  return (
                    <button key={p.id} type="button" className={`preset-card${presetId === p.id ? " is-selected" : ""}`} aria-pressed={presetId === p.id} onClick={() => setPresetId(p.id)}>
                      <PresetVignette preset={p} />
                      <strong>{p.labelPt}</strong>
                      <span className="caption">{c} {c === 1 ? "crédito" : "créditos"}{p.premium ? " · premium" : ""}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {preset ? (
              <section className="stack" aria-labelledby="st-opcoes">
                <h2 id="st-opcoes">3. Detalhes</h2>
                {preset.aspects.length > 1 ? (
                  <div role="radiogroup" aria-label="Proporção" className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                    {preset.aspects.map((a) => (
                      <button key={a} type="button" role="radio" aria-checked={(aspect ?? preset.aspect) === a} className={`chip ${(aspect ?? preset.aspect) === a ? "" : "chip--outline"}`} style={{ minHeight: 44, padding: "0 14px", cursor: "pointer" }} onClick={() => setAspect(a)}>
                        {STUDIO_FORMATS[a].labelPt} ({a})
                      </button>
                    ))}
                  </div>
                ) : <p className="caption">Formato: {STUDIO_FORMATS[preset.aspect].labelPt} ({preset.aspect})</p>}
                {preset.addTextOverlay ? (
                  <>
                    <div className="field"><label htmlFor="st-msg">Mensagem <span className="muted">(o app escreve por cima; a IA não escreve texto)</span></label><input id="st-msg" className="input" maxLength={80} value={overlay.message ?? ""} onChange={(e) => setOverlay({ ...overlay, message: e.target.value })} /></div>
                    <div className="field"><label htmlFor="st-nome">Nome</label><input id="st-nome" className="input" maxLength={40} value={overlay.name ?? ""} onChange={(e) => setOverlay({ ...overlay, name: e.target.value })} /></div>
                  </>
                ) : null}
                {preset.post === "card" ? (
                  <div role="radiogroup" aria-label="Moldura" className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                    {(["simples", "patinhas", "festa"] as const).map((f) => (
                      <button key={f} type="button" role="radio" aria-checked={overlay.frame === f} className={`chip ${overlay.frame === f ? "" : "chip--outline"}`} style={{ minHeight: 44, padding: "0 14px", cursor: "pointer" }} onClick={() => setOverlay({ ...overlay, frame: f })}>
                        Moldura {f}
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="card stack" aria-labelledby="st-custo">
              <h2 id="st-custo" style={{ fontSize: "1.0625rem" }}>4. Confirmar</h2>
              <p className="small">{preset ? <>Custa <strong>{credits} {credits === 1 ? "crédito" : "créditos"}</strong>{REAL_MODE && state ? <> · você tem {state.balance}</> : null}. Se a geração falhar, o crédito volta.</> : "Escolha uma foto e um tema."}</p>
              <p className="caption">A foto escolhida é enviada ao Google (Gemini) só para gerar esta arte. <Link href="/sobre#estudio">Saiba mais</Link></p>
              {error ? <p className="field-error" role="alert">{error}</p> : null}
              <button type="button" className="btn btn--primary btn--block" onClick={create} disabled={!canCreate}>
                <IconBrush /> {busy ? "Começando…" : preset ? `Criar arte (${credits} ${credits === 1 ? "crédito" : "créditos"})` : "Criar arte"}
              </button>
              {REAL_MODE && state && preset && state.balance < credits ? <p className="small">Seus créditos acabaram. <Link href="/estudio/creditos">Comprar créditos</Link></p> : null}
              {preset && REAL_MODE ? <p className="caption">Custo estimado de IA: US$ {estimateCostUsd(preset, aspect ?? preset.aspect).toFixed(3)} (referência interna de teste).</p> : null}
            </section>
          </>
        )}

        {REAL_MODE && state && state.jobs.some((j) => j.state === "succeeded") ? (
          <section className="stack" aria-labelledby="st-hist">
            <h2 id="st-hist">Histórico</h2>
            <p className="caption">Rever uma arte não cobra de novo.</p>
            <ul className="preset-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {state.jobs.filter((j) => j.state === "succeeded" && j.outputMediaId).map((j) => (
                <li key={j.id}>
                  <button type="button" className="preset-card" onClick={() => setCurrent(j)} aria-label={`Abrir arte ${presetById(j.presetId)?.labelPt ?? ""}`}>
                    <MediaImage id={j.outputMediaId} alt="" className="studio-history__img" />
                    <span className="caption">{presetById(j.presetId)?.labelPt}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="caption"><IconCheck size={14} /> Artes nunca concluem missões de foto: elas vão para o álbum Datas especiais.</p>
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
