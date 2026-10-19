"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useCatalog } from "@/i18n/catalog";
import { getMedia, type Snapshot } from "@/data/demo-repository";
import { useStore } from "@/data/store";
import { setProgress, type SetProgress } from "@/domain/cycle";
import { missionById } from "@/domain/missions";
import { MediaImage } from "./media";
import { IconCheck, IconDownload, IconStar } from "./icons";

/** Coleções permanentes (MUDANCAS-V2 §7.2): 6 espaços, contador, medalha e capa especial. */
export function CollectionsView({ snap }: { snap: Snapshot }) {
  const progress = useMemo(() => setProgress(snap.completions, snap.collectionAdvances), [snap]);
  const medals = new Set(snap.medals.map((m) => m.setId));
  const entries = new Map(snap.entries.map((e) => [e.id, e]));
  const next = progress.filter((p) => !p.complete).sort((a, b) => b.done - a.done)[0];
  const t = useTranslations("collections");
  const cat = useCatalog(snap.dog?.name ?? "");

  return (
    <div className="stack-lg">
      <p className="page-note">{t("intro")}</p>
      {next && progress.some((p) => p.complete) ? (
        <p className="notice notice--info small"><IconStar size={18} /><span>{t.rich("next", { title: cat.set(next.set.id).title, n: next.done, strong: (c) => <strong>{c}</strong> })}</span></p>
      ) : null}
      {progress.map((p) => (
        <section key={p.set.id} className="card stack" aria-labelledby={`set-${p.set.id}`}>
          <div className="row-between" style={{ alignItems: "flex-start" }}>
            <div className="stack" style={{ gap: 2 }}>
              <h2 id={`set-${p.set.id}`} style={{ fontSize: "1.125rem" }}>{cat.set(p.set.id).title}</h2>
              <span className="caption">{t("of6", { n: p.done })}{cat.set(p.set.id).note ? ` · ${cat.set(p.set.id).note}` : ""}</span>
            </div>
            {medals.has(p.set.id) ? <span className="medal anim-stamp" role="img" aria-label={t("medal")}><IconStar size={22} /></span> : null}
          </div>
          <ul className="set-grid" aria-label={t("slots", { title: cat.set(p.set.id).title })}>
            {p.items.map((it) => {
              const m = missionById(it.missionId)!;
              const mt = cat.title(m);
              const entry = it.entryId ? entries.get(it.entryId) : undefined;
              return (
                <li key={it.missionId}>
                  {it.done ? (
                    <Link href={entry ? `/diario#${entry.id}` : `/missoes/${m.slug}`} className="set-slot set-slot--done" aria-label={t("slotDone", { title: mt })}>
                      {entry ? <MediaImage id={entry.mediaId} alt="" className="set-slot__img" /> : <span className="set-slot__icon"><IconCheck /></span>}
                      <span className="set-slot__label">{mt}</span>
                    </Link>
                  ) : (
                    <Link href={`/missoes/${m.slug}`} className="set-slot" aria-label={t("slotTodo", { title: mt })}>
                      <span className="set-slot__icon"><IconStar /></span>
                      <span className="set-slot__label">{mt}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          {p.complete ? <SpecialCover progress={p} snap={snap} /> : null}
        </section>
      ))}
    </div>
  );
}

/** Capa especial: colagem 2×3 das 6 fotos, desenhada no navegador com canvas (não é IA). */
function SpecialCover({ progress, snap }: { progress: SetProgress; snap: Snapshot }) {
  const { repo } = useStore();
  const [url, setUrl] = useState<string | null>(null);
  const entries = useMemo(() => new Map(snap.entries.map((e) => [e.id, e])), [snap]);
  const t = useTranslations("collections");
  const cat = useCatalog(snap.dog?.name ?? "");
  const setTitle = cat.set(progress.set.id).title;
  const subtitle = t("coverSubtitle", { dog: snap.dog?.name ?? "" });

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    (async () => {
      if (!repo) return;
      const W = 600, H = 900, cell = 280, gap = 14, top = 110;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff8ec";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3d2d1e";
      ctx.font = "700 40px 'Baloo 2 Variable', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(setTitle, W / 2, 62);
      ctx.font = "600 22px 'Nunito Variable', system-ui, sans-serif";
      ctx.fillText(subtitle, W / 2, 94);
      for (const [i, it] of progress.items.entries()) {
        const x = gap + (i % 2) * (cell + gap) + 6, y = top + Math.floor(i / 2) * (cell + gap);
        ctx.fillStyle = "#d3efea";
        ctx.fillRect(x, y, cell, cell);
        const entry = it.entryId ? entries.get(it.entryId) : undefined;
        const thumb = entry ? await repo.getMediaBlob(entry.mediaId, "thumb") : null;
        if (thumb) {
          const bmp = await createImageBitmap(thumb);
          const s = Math.max(cell / bmp.width, cell / bmp.height);
          const w = bmp.width * s, h = bmp.height * s;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, cell, cell);
          ctx.clip();
          ctx.drawImage(bmp, x + (cell - w) / 2, y + (cell - h) / 2, w, h);
          ctx.restore();
          bmp.close();
        }
      }
      ctx.fillStyle = "#6b5a4a";
      ctx.font = "600 18px 'Nunito Variable', system-ui, sans-serif";
      ctx.fillText("Diário de Patas · Sempre Juntos", W / 2, H - 20);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      if (blob && alive) {
        made = URL.createObjectURL(blob);
        setUrl(made);
      }
    })();
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [repo, progress, entries, setTitle, subtitle]);

  if (!url) return <div className="skeleton" style={{ aspectRatio: "2 / 3", maxWidth: 240 }} aria-hidden="true" />;
  return (
    <div className="stack" style={{ alignItems: "flex-start" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={t("coverAlt", { title: setTitle })} className="set-cover anim-pop" />
      <a href={url} download={`${t("coverFile")}-${progress.set.id}.jpg`} className="btn btn--secondary btn--small"><IconDownload size={18} /> {t("downloadCover")}</a>
    </div>
  );
}
