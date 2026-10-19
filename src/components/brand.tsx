/**
 * Marca a partir do logo enviado pelo proprietário (docs/brand-source/logo-original.jpg).
 * Recortes gerados por scripts/cut-logo.py em /public/brand. Nenhum componente depende
 * do desenho em si: trocar os PNGs troca a marca.
 */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useLocale, useTranslations } from "next-intl";

/** Rosto do Abu num quadradinho verde-água — cabeçalho e favicon. */
export function AbuFace({ size = 52, className = "abu-face" }: { size?: number; className?: string }) {
  return (
    <span className={className} style={{ width: size, height: size }} aria-hidden="true">
      <img src="/brand/favicon-64.png" alt="" width={size} height={size} />
    </span>
  );
}

/** Abu segurando o livro, sem fundo. */
export function AbuMascot({ width = 220, className, alt = "" }: { width?: number; className?: string; alt?: string }) {
  return <img src="/brand/abu-mascote.png" alt={alt} width={width} height={Math.round(width * (562 / 460))} className={className} style={{ display: "block", height: "auto" }} aria-hidden={alt ? undefined : true} />;
}

/** Cartão completo do logo (Abu + “Diário de Patas · Sempre Juntos”). */
export function LogoCard({ width = 240, className }: { width?: number; className?: string }) {
  return <img src="/brand/logo-card.png" alt="Diário de Patas — Sempre Juntos" width={width} height={Math.round(width * (824 / 672))} className={className} style={{ display: "block", height: "auto" }} />;
}

/** Só a ilustração do cartão (Abu + livro), sem o texto — para telas que já mostram o nome. */
export function AbuCard({ width = 220, className }: { width?: number; className?: string }) {
  const t = useTranslations("brand");
  return <img src="/brand/abu-card.png" alt={t("abuReading")} width={width} height={Math.round(width * (623 / 664))} className={className} style={{ display: "block", height: "auto" }} />;
}

/**
 * Assinatura do cabeçalho: rosto do Abu + nome com a fonte do logo. A marca é a mesma nos dois idiomas
 * ("Diário de Patas", "Sempre Juntos"); em inglês, "Paw Diary" aparece discreto embaixo, só aqui no cabeçalho.
 */
export function BrandLockup({ withTagline = false }: { withTagline?: boolean }) {
  const locale = useLocale();
  return (
    <span className="brand-lockup">
      <span className="brand-lockup__face"><img src="/brand/favicon-64.png" alt="" /></span>
      <span>
        <span className="brand-lockup__name">Diário de Patas</span>
        {withTagline ? <span className="brand-lockup__tag">Sempre Juntos</span> : locale === "en" ? <span className="brand-lockup__tag brand-lockup__tag--en" lang="en">Paw Diary</span> : null}
      </span>
    </span>
  );
}

/** Nome em inglês, discreto, para telas que mostram a marca grande (entrada e apresentação). */
export function PawDiaryNote({ className = "brand-en" }: { className?: string }) {
  return useLocale() === "en" ? <span className={className} lang="en">Paw Diary</span> : null;
}

/** Bilhete do Abu — uso moderado (§4). */
export function AbuSays({ children }: { children: React.ReactNode }) {
  return (
    <div className="row anim-rise" style={{ alignItems: "flex-start" }}>
      <AbuFace />
      <div className="abu-note">
        <p className="abu-note__name">Abu</p>
        <p className="abu-note__text">{children}</p>
      </div>
    </div>
  );
}
