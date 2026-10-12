/**
 * Identidade "Plaquinha" (docs/BRAND.md): o símbolo é a plaquinha da coleira do Abu,
 * com o nome dele gravado. Não é um retrato — quando houver fotos de referência,
 * a ilustração do Abu pode ser gravada na plaquinha. Os arquivos vivem em /public/brand
 * e são gerados por scripts/build-brand.py; nenhum componente depende do desenho.
 */
/* eslint-disable @next/next/no-img-element */

export function TagMark({ size = 40, title }: { size?: number; title?: string }) {
  return <img src="/brand/symbol.svg" width={size * (100 / 120)} height={size} alt={title ?? ""} aria-hidden={title ? undefined : true} style={{ display: "block" }} />;
}

export function Wordmark({ size = 32 }: { size?: number }) {
  return <img src="/brand/logo-horizontal.svg" alt="Diário de Patas" className="wordmark" style={{ height: size * 1.4 }} />;
}

/** Bilhete do Abu, o anfitrião — uso moderado (§4). */
export function AbuSays({ children }: { children: React.ReactNode }) {
  return (
    <div className="row" style={{ alignItems: "flex-start" }}>
      <TagMark size={48} />
      <div className="abu-note">
        <p className="abu-note__name">Abu</p>
        <p className="abu-note__text">{children}</p>
      </div>
    </div>
  );
}
