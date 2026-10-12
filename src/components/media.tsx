"use client";

import { useBlobUrl, useMedia } from "@/data/store";
import { Paw } from "./icons";

/** Foto privada do diário. Alt text descritivo e neutro — nada de emoções presumidas (§20). */
export function MediaImage({
  id, variant = "thumb", alt, className, style,
}: { id: string | null | undefined; variant?: "thumb" | "display"; alt: string; className?: string; style?: React.CSSProperties }) {
  const media = useMedia(id);
  const url = useBlobUrl(media ? media[variant] : null);
  if (media === undefined) return <div className={`skeleton ${className ?? ""}`} style={style} aria-hidden="true" />;
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

export function DogAvatar({ mediaId, name, size = "md" }: { mediaId: string | null; name: string; size?: "md" | "lg" | "xl" }) {
  const cls = `avatar${size === "lg" ? " avatar--lg" : size === "xl" ? " avatar--xl" : ""}`;
  if (!mediaId) {
    return (
      <span className={cls} style={{ color: "var(--brand-primary)" }} aria-hidden="true">
        <Paw size={size === "xl" ? 40 : size === "lg" ? 28 : 20} />
      </span>
    );
  }
  return <MediaImage id={mediaId} alt={`Foto de ${name}`} className={cls} />;
}
