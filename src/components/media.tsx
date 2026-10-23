"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useBlobUrl, useMediaBlob } from "@/data/store";
import { Paw } from "./icons";
import type { AvatarCrop } from "@/domain/types";

/**
 * true quando o elemento chega perto da tela (até ~1,5 tela de distância) e continua true. Assim o Diário só baixa
 * as fotos que a pessoa está para ver, em vez de todas de uma vez.
 */
function useNearViewport<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const io = new IntersectionObserver((list) => { if (list.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: "150% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near];
}

/** Foto privada do diário. Alt text descritivo e neutro — nada de emoções presumidas (§20). */
export function MediaImage({
  id, variant = "thumb", alt, className, style,
}: { id: string | null | undefined; variant?: "thumb" | "display"; alt: string; className?: string; style?: React.CSSProperties }) {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  const blob = useMediaBlob(id, variant, near);
  const url = useBlobUrl(blob);
  const t = useTranslations("media");
  if (blob === undefined) return <div ref={ref} className={`skeleton ${className ?? ""}`} style={style} aria-hidden="true" />;
  if (!url) {
    return (
      <div className={className} style={{ display: "grid", placeItems: "center", color: "var(--sage)", ...style }} role="img" aria-label={t("unavailable", { alt })}>
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
  const t = useTranslations("media");
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
      <MediaImage id={mediaId} alt={t("photoOf", { name })} className="avatar__img" style={avatarImgStyle(crop)} />
    </span>
  );
}
