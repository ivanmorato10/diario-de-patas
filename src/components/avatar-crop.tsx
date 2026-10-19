"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { AvatarCrop } from "@/domain/types";
import { Sheet } from "@/components/entry-actions";
import { MediaImage, avatarImgStyle } from "@/components/media";

const CENTER: AvatarCrop = { x: 50, y: 50, zoom: 1 };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Ajuste da foto de perfil: arrastar para posicionar e zoom; o círculo mostra exatamente o resultado. */
export function AvatarCropSheet({ open, onClose, mediaId, name, value, onSave, onPreview }: {
  open: boolean; onClose: () => void; mediaId: string; name: string; value: AvatarCrop | null | undefined; onSave: (c: AvatarCrop) => void;
  /** Ao vivo: a foto do topo e a do perfil acompanham o ajuste enquanto a janela está aberta. */
  onPreview?: (c: AvatarCrop) => void;
}) {
  const [crop, setCrop] = useState<AvatarCrop>(value ?? CENTER);
  const t = useTranslations("avatarCrop");
  const preview = useRef(onPreview);
  preview.current = onPreview;
  useEffect(() => { preview.current?.(crop); }, [crop]);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const SIZE = 200;
  const [start] = useState<AvatarCrop>(value ?? CENTER); // como estava ao abrir (o valor ao vivo muda o snapshot)
  const dirty = crop.x !== start.x || crop.y !== start.y || crop.zoom !== start.zoom;
  // Fechar a janela (tocar fora, arrastar para baixo, voltar) também salva: ninguém perde o ajuste.
  const close = () => { if (dirty) onSave(crop); onClose(); };

  function down(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    // Arrastar a foto para a direita mostra mais do lado esquerdo (o foco anda ao contrário).
    const k = 100 / (SIZE * crop.zoom);
    setCrop((c) => ({ ...c, x: clamp(d.x - (e.clientX - d.px) * k, 0, 100), y: clamp(d.y - (e.clientY - d.py) * k, 0, 100) }));
  }
  const up = () => { drag.current = null; };

  return (
    <Sheet open={open} onClose={close} labelledBy="crop-title">
      <h2 id="crop-title">{t("title", { dog: name })}</h2>
      <p className="page-note">{t("note")}</p>
      <div className="avatar-crop" style={{ width: SIZE, height: SIZE }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        role="img" aria-label={t("preview")}>
        <MediaImage id={mediaId} variant="display" alt="" className="avatar__img" style={{ ...avatarImgStyle(crop), pointerEvents: "none" }} />
      </div>
      <button type="button" className="btn btn--primary btn--block" onClick={close}>{dirty ? t("save") : t("done")}</button>
      <div className="field">
        <label htmlFor="crop-zoom">{t("zoom")}</label>
        <input id="crop-zoom" type="range" min={1} max={3} step={0.05} value={crop.zoom} onChange={(e) => setCrop({ ...crop, zoom: Number(e.target.value) })} />
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 120 }}>
          <label htmlFor="crop-x">{t("x")}</label>
          <input id="crop-x" type="range" min={0} max={100} value={crop.x} onChange={(e) => setCrop({ ...crop, x: Number(e.target.value) })} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 120 }}>
          <label htmlFor="crop-y">{t("y")}</label>
          <input id="crop-y" type="range" min={0} max={100} value={crop.y} onChange={(e) => setCrop({ ...crop, y: Number(e.target.value) })} />
        </div>
      </div>
      <button type="button" className="btn btn--ghost btn--block" onClick={() => setCrop(CENTER)}>{t("center")}</button>
    </Sheet>
  );
}
