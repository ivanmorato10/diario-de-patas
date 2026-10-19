"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/i18n/use-error";
import { processImage, ImageError } from "@/lib/image";
import type { ProcessedImage } from "@/data/demo-repository";
import { IconCamera, IconImage } from "./icons";

export interface PickFailure {
  name: string;
  message: string;
}

/**
 * Câmera ou galeria → foto processada localmente. Erros com próximo passo (§5).
 * Com `onPickedMany`, a galeria aceita várias fotos (MUDANCAS-V2 §2); escolher uma só continua indo para `onPicked`.
 */
export function PhotoPicker({
  onPicked, onPickedMany, maxFiles, disabled, compact, tiles,
}: {
  /** Pode ser assíncrono: o "Preparando…" fica até ele terminar. */
  onPicked: (img: ProcessedImage) => void | Promise<void>;
  onPickedMany?: (imgs: ProcessedImage[], failures: PickFailure[], skipped: number) => void;
  /** Quantas fotos cabem nesta seleção; as excedentes não são processadas. */
  maxFiles?: number;
  disabled?: boolean;
  compact?: boolean;
  /** Dois botões grandes, coloridos (tela Guardar momento). */
  tiles?: boolean;
}) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errId = useId();
  const t = useTranslations("photoPicker");
  const errText = useErrorText();

  const message = (err: unknown) => errText(err instanceof ImageError ? err.message : "errors.imageOpen");

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);
    if (files.length === 1 || !onPickedMany) {
      setBusy(t("preparing"));
      try {
        await onPicked(await processImage(files[0]));
      } catch (err) {
        setError(message(err));
      } finally {
        setBusy(null);
      }
      return;
    }
    const take = maxFiles === undefined ? files : files.slice(0, Math.max(0, maxFiles));
    const imgs: ProcessedImage[] = [];
    const failures: PickFailure[] = [];
    try {
      for (const [i, f] of take.entries()) {
        setBusy(t("preparingMany", { n: i + 1, total: take.length }));
        try {
          imgs.push(await processImage(f));
        } catch (err) {
          failures.push({ name: f.name || t("photoN", { n: i + 1 }), message: message(err) });
        }
      }
    } finally {
      setBusy(null);
    }
    onPickedMany(imgs, failures, files.length - take.length);
  }

  return (
    <div className="stack">
      {tiles ? (
        <div className="pick-tiles">
          <button type="button" className="pick-tile pick-tile--cam" onClick={() => cam.current?.click()} disabled={disabled || !!busy} aria-describedby={error ? errId : undefined}>
            <span className="pick-tile__icon" aria-hidden="true">📷</span><strong>{t("takePhoto")}</strong><span className="pick-tile__sub">{t("now")}</span>
          </button>
          <button type="button" className="pick-tile pick-tile--gal" onClick={() => gal.current?.click()} disabled={disabled || !!busy} aria-describedby={error ? errId : undefined}>
            <span className="pick-tile__icon" aria-hidden="true">🖼️</span><strong>{t("fromGallery")}</strong><span className="pick-tile__sub">{onPickedMany ? t("oneOrMany") : t("evenOld")}</span>
          </button>
        </div>
      ) : (
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button type="button" className={`btn btn--secondary${compact ? " btn--small" : ""}`} onClick={() => cam.current?.click()} disabled={disabled || !!busy} aria-describedby={error ? errId : undefined}>
          <IconCamera /> {t("takePhoto")}
        </button>
        <button type="button" className={`btn btn--secondary${compact ? " btn--small" : ""}`} onClick={() => gal.current?.click()} disabled={disabled || !!busy} aria-describedby={error ? errId : undefined}>
          <IconImage /> {onPickedMany ? t("pickManyFromGallery") : t("pickFromGallery")}
        </button>
      </div>
      )}
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
      <input ref={gal} type="file" accept="image/jpeg,image/png,image/webp,image/*" multiple={!!onPickedMany} hidden onChange={handle} />
      <p aria-live="polite" className="caption">{busy ?? ""}</p>
      {error ? <p id={errId} className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
