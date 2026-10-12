"use client";

import { useId, useRef, useState } from "react";
import { processImage, ImageError } from "@/lib/image";
import type { ProcessedImage } from "@/data/demo-repository";
import { IconCamera, IconImage } from "./icons";

/** Câmera ou galeria → foto processada localmente. Erros com próximo passo (§5). */
export function PhotoPicker({
  onPicked, disabled, compact,
}: { onPicked: (img: ProcessedImage) => void; disabled?: boolean; compact?: boolean }) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errId = useId();

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onPicked(await processImage(file));
    } catch (err) {
      setError(err instanceof ImageError ? err.message : "Não conseguimos abrir essa foto. Tente outra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button type="button" className={`btn btn--secondary${compact ? " btn--small" : ""}`} onClick={() => cam.current?.click()} disabled={disabled || busy} aria-describedby={error ? errId : undefined}>
          <IconCamera /> Tirar foto
        </button>
        <button type="button" className={`btn btn--secondary${compact ? " btn--small" : ""}`} onClick={() => gal.current?.click()} disabled={disabled || busy} aria-describedby={error ? errId : undefined}>
          <IconImage /> Escolher da galeria
        </button>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
      <input ref={gal} type="file" accept="image/jpeg,image/png,image/webp,image/*" hidden onChange={handle} />
      <p aria-live="polite" className="caption">{busy ? "Preparando a foto…" : ""}</p>
      {error ? <p id={errId} className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
