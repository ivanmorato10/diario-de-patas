"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useBlobUrl, useMediaBlob } from "@/data/store";
import { Paw } from "./icons";
import type { AvatarCrop } from "@/domain/types";

/**
 * true quando o elemento chega perto da tela (`margin` de distância) e continua true. Assim o Diário só baixa
 * as fotos que a pessoa está para ver, em vez de todas de uma vez. `always`: baixa já (ex.: a próxima do painel).
 */
function useNearViewport(margin = "150% 0px", always = false): [(el: Element | null) => void, boolean] {
  // Segue o elemento ATUAL (esqueleto, miniatura ou foto): trocar o que está na tela não perde a observação.
  const [el, setEl] = useState<Element | null>(null);
  const [near, setNear] = useState(always);
  useEffect(() => {
    if (near || !el) return;
    if (typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const io = new IntersectionObserver((list) => { if (list.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [el, near, margin]);
  return [setEl, near];
}

/**
 * `preload`: baixa já, mesmo fora da tela (ex.: a próxima foto do painel, que fica escondida).
 * Foto grande ("display"): a miniatura aparece primeiro (pequena, chega rápido mesmo em rede lenta) e é trocada pela
 * grande quando ela chega; a grande só começa a baixar mais perto da tela, para não disputar banda com a que está à vista.
 */
export function MediaImage({
  id, variant = "thumb", alt, className, style, preload = false,
}: { id: string | null | undefined; variant?: "thumb" | "display"; alt: string; className?: string; style?: React.CSSProperties; preload?: boolean }) {
  const [ref, near] = useNearViewport("150% 0px", preload);
  const [bigRef, bigNear] = useNearViewport("50% 0px", preload);
  const display = variant === "display";
  const blob = useMediaBlob(id, variant, display ? bigNear : near);
  const thumb = useMediaBlob(display && !preload ? id : null, "thumb", display && !preload && near && blob === undefined);
  const url = useBlobUrl(blob ?? (blob === undefined && display ? thumb : undefined));
  const t = useTranslations("media");
  const setRefs = (el: Element | null) => { ref(el); bigRef(el); };
  if (blob === undefined && url) {
    // Miniatura enquanto a grande chega (o observador segue esta imagem até a grande começar a baixar).
    // eslint-disable-next-line @next/next/no-img-element
    return <img ref={setRefs} src={url} alt={alt} className={className} style={style} decoding="async" />;
  }
  if (blob === undefined) return <div ref={setRefs} className={`skeleton ${className ?? ""}`} style={style} aria-hidden="true" />;
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

/** `decorative`: o nome já está escrito ao lado (ex.: lista de cachorros) — a foto não repete o nome para leitores de tela. */
export function DogAvatar({ mediaId, name, size = "md", crop, decorative = false }: { mediaId: string | null; name: string; size?: "md" | "lg" | "xl"; crop?: AvatarCrop | null; decorative?: boolean }) {
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
      <MediaImage id={mediaId} alt={decorative ? "" : t("photoOf", { name })} className="avatar__img" style={avatarImgStyle(crop)} />
    </span>
  );
}
