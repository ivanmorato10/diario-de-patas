/**
 * Identidade PROVISÓRIA (§4, §6): caderno com patinha.
 * Não é um retrato do Abu — não há fotos de referência. Ao receber fotos, substituir
 * apenas este arquivo e /public/brand/*; os componentes não dependem do desenho.
 */
export function NotebookMark({ size = 40, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect x="12" y="6" width="44" height="52" rx="10" fill="#285943" />
      <rect x="12" y="6" width="10" height="52" rx="5" fill="#1f4835" />
      <g fill="#FFF9F1">
        <circle cx="17" cy="16" r="1.8" /><circle cx="17" cy="26" r="1.8" /><circle cx="17" cy="36" r="1.8" /><circle cx="17" cy="46" r="1.8" />
      </g>
      <g fill="#E8B84A" transform="translate(27 17) scale(1.15)">
        <ellipse cx="12" cy="16" rx="5" ry="4.2" />
        <ellipse cx="5.6" cy="10.4" rx="2.2" ry="2.7" transform="rotate(-18 5.6 10.4)" />
        <ellipse cx="9.6" cy="6.6" rx="2.2" ry="2.8" transform="rotate(-6 9.6 6.6)" />
        <ellipse cx="14.4" cy="6.6" rx="2.2" ry="2.8" transform="rotate(6 14.4 6.6)" />
        <ellipse cx="18.4" cy="10.4" rx="2.2" ry="2.7" transform="rotate(18 18.4 10.4)" />
      </g>
      <rect x="44" y="6" width="6" height="16" fill="#C65D3B" />
      <path d="M44 22l3-3 3 3z" fill="#285943" />
    </svg>
  );
}

export function Wordmark({ size = 32 }: { size?: number }) {
  return (
    <span className="row" style={{ gap: 10 }}>
      <NotebookMark size={size} />
      <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: size * 0.62, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
        Diário de Patas
      </span>
    </span>
  );
}

/** Abu como anfitrião, com o símbolo provisório — uso moderado (§4). */
export function AbuSays({ children }: { children: React.ReactNode }) {
  return (
    <div className="row" style={{ alignItems: "flex-start" }}>
      <NotebookMark size={44} />
      <div className="card card--accent" style={{ padding: "12px 16px", borderRadius: "4px 18px 18px 18px" }}>
        <p className="caption" style={{ fontWeight: 600, color: "var(--accent-text)" }}>Abu</p>
        <p>{children}</p>
      </div>
    </div>
  );
}
