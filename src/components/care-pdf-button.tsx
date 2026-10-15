"use client";

import { useState } from "react";
import { useMediaBlob, useStore } from "@/data/store";
import type { AvatarCrop } from "@/domain/types";

const buf = (url: string) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);

/** Foto de perfil recortada em círculo (com o mesmo zoom/posição do app), como PNG para o PDF. */
async function avatarPng(blob: Blob, crop: AvatarCrop | null | undefined): Promise<ArrayBuffer | null> {
  try {
    const img = await createImageBitmap(blob);
    const S = 240, c = document.createElement("canvas");
    c.width = c.height = S;
    const ctx = c.getContext("2d")!;
    const zoom = crop?.zoom ?? 1, fx = (crop?.x ?? 50) / 100, fy = (crop?.y ?? 50) / 100;
    // Igual ao CSS do avatar: object-fit cover + object-position (fx, fy) + scale(zoom) com origem no foco.
    const base = Math.min(img.width, img.height);
    const left = (img.width - base) * fx, top = (img.height - base) * fy;
    const side = base / zoom;
    const sx = left + fx * base - fx * side, sy = top + fy * base - fy * side;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, sx, sy, side, side, 0, 0, S, S);
    img.close();
    const out = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
    return out ? out.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Gera a ficha de cuidados em PDF no aparelho e abre o compartilhar (WhatsApp, email…) ou baixa o arquivo. */
export function CarePdfButton() {
  const { snap } = useStore();
  const photo = useMediaBlob(snap?.dog?.photoMediaId ?? null, "thumb");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!snap?.dog) return null;

  async function make() {
    if (!snap?.dog) return;
    setBusy(true);
    setMsg(null);
    try {
      const { buildCarePdf } = await import("@/lib/care-pdf");
      const [logoPng, heading, hand, body, bodyBold] = await Promise.all([
        buf("/brand/favicon-64.png"),
        buf("/fonts/pdf/baloo-2-latin-800-normal.woff"), buf("/fonts/pdf/caveat-latin-700-normal.woff"),
        buf("/fonts/pdf/nunito-latin-400-normal.woff"), buf("/fonts/pdf/nunito-latin-700-normal.woff"),
      ]);
      const fonts = heading && hand && body && bodyBold ? { heading, hand, body, bodyBold } : null;
      const avatar = photo ? await avatarPng(photo, snap.dog.avatarCrop) : null;
      const bytes = await buildCarePdf({ dogName: snap.dog.name, birthDate: snap.dog.birthDate, today: snap.today, health: snap.health, logoPng, avatarPng: avatar, fonts });
      const name = `ficha-de-cuidados-${snap.dog.name.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase()}.pdf`;
      const file = new File([bytes as BlobPart], name, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Ficha de cuidados de ${snap.dog.name}` }).catch(() => undefined);
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setMsg("PDF baixado.");
      }
    } catch {
      setMsg("Não conseguimos gerar o PDF. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 4 }}>
      <button type="button" className="btn btn--block btn--vet" onClick={make} disabled={busy}>📄 {busy ? "Gerando PDF…" : "PDF para o veterinário"}</button>
      {msg ? <span className="caption" style={{ textAlign: "center" }}>{msg}</span> : null}
    </div>
  );
}
