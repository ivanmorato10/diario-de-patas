"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

  return (
    <div className="stack-lg">
      <p className="page-note">Cada coleção tem 6 desafios, sem prazo. Completar uma coleção vale uma medalha, uma capa especial e +50 XP.</p>
      {next && progress.some((p) => p.complete) ? (
        <p className="notice notice--info small"><IconStar size={18} /><span>Próxima sugestão: <strong>{next.set.title}</strong> ({next.done} de 6).</span></p>
      ) : null}
      {progress.map((p) => (
        <section key={p.set.id} className="card stack" aria-labelledby={`set-${p.set.id}`}>
          <div className="row-between" style={{ alignItems: "flex-start" }}>
            <div className="stack" style={{ gap: 2 }}>
              <h2 id={`set-${p.set.id}`} style={{ fontSize: "1.125rem" }}>{p.set.title}</h2>
              <span className="caption">{p.done} de 6{p.set.note ? ` · ${p.set.note}` : ""}</span>
            </div>
            {medals.has(p.set.id) ? <span className="medal anim-stamp" role="img" aria-label="Medalha conquistada"><IconStar size={22} /></span> : null}
          </div>
          <ul className="set-grid" aria-label={`Espaços de ${p.set.title}`}>
            {p.items.map((it) => {
              const m = missionById(it.missionId)!;
              const entry = it.entryId ? entries.get(it.entryId) : undefined;
              return (
                <li key={it.missionId}>
                  {it.done ? (
                    <Link href={entry ? `/diario#${entry.id}` : `/missoes/${m.slug}`} className="set-slot set-slot--done" aria-label={`${m.title}: concluído`}>
                      {entry ? <MediaImage id={entry.mediaId} alt="" className="set-slot__img" /> : <span className="set-slot__icon"><IconCheck /></span>}
                      <span className="set-slot__label">{m.title}</span>
                    </Link>
                  ) : (
                    <Link href={`/missoes/${m.slug}`} className="set-slot" aria-label={`${m.title}: ainda não`}>
                      <span className="set-slot__icon"><IconStar /></span>
                      <span className="set-slot__label">{m.title}</span>
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
      ctx.fillText(progress.set.title, W / 2, 62);
      ctx.font = "600 22px 'Nunito Variable', system-ui, sans-serif";
      ctx.fillText(`Coleção completa · ${snap.dog?.name ?? ""}`, W / 2, 94);
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
  }, [repo, progress, entries, snap.dog?.name]);

  if (!url) return <div className="skeleton" style={{ aspectRatio: "2 / 3", maxWidth: 240 }} aria-hidden="true" />;
  return (
    <div className="stack" style={{ alignItems: "flex-start" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Capa especial da coleção ${progress.set.title}, com as 6 fotos`} className="set-cover anim-pop" />
      <a href={url} download={`capa-${progress.set.id}.jpg`} className="btn btn--secondary btn--small"><IconDownload size={18} /> Baixar capa</a>
    </div>
  );
}
