"use client";

import { useBlobUrl, useMediaBlob } from "@/data/store";
import { Paw } from "./icons";
import type { AvatarCrop } from "@/domain/types";

/** Foto privada do diário. Alt text descritivo e neutro — nada de emoções presumidas (§20). */
export function MediaImage({
  id, variant = "thumb", alt, className, style,
}: { id: string | null | undefined; variant?: "thumb" | "display"; alt: string; className?: string; style?: React.CSSProperties }) {
  const blob = useMediaBlob(id, variant);
  const url = useBlobUrl(blob);
  if (blob === undefined) return <div className={`skeleton ${className ?? ""}`} style={style} aria-hidden="true" />;
  if (!url) {
    return (
      <div className={className} style={{ display: "grid", placeItems: "center", color: "var(--sage)", ...style }} role="img" aria-label={`${alt} (foto indisponível)`}>
        <Paw size={28} />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} style={style} loading="lazy" decoding="async" />;
}

/** Estilo da foto dentro do círculo conforme o ajuste salvo (foco e zoom). */
export const avatarImgStyle = (crop?: AvatarCrop | null): React.CSSProperties =>
  crop ? { objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` } : {};

export function DogAvatar({ mediaId, name, size = "md", crop }: { mediaId: string | null; name: string; size?: "md" | "lg" | "xl"; crop?: AvatarCrop | null }) {
  const cls = `avatar${size === "lg" ? " avatar--lg" : size === "xl" ? " avatar--xl" : ""}`;
  if (!mediaId) {
    return (
      <span className={cls} style={{ color: "var(--brand-primary)" }} aria-hidden="true">
        <Paw size={size === "xl" ? 40 : size === "lg" ? 28 : 20} />
      </span>
    );
  }
  return (
    <span className={cls}>
      <MediaImage id={mediaId} alt={`Foto de ${name}`} className="avatar__img" style={avatarImgStyle(crop)} />
    </span>
  );
}
