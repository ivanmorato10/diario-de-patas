"use client";

import { useState } from "react";

/**
 * Par padrão "Enviar pelo WhatsApp" + "Copiar" (com "✓ Copiado!"): mesmo estilo, mesma largura e altura,
 * um embaixo do outro. Usado no convite da família e no "Indicar o app".
 */
export function ShareActions({ text, copyLabel = "Copiar convite", onCopyError }: { text: string; copyLabel?: string; onCopyError?: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onCopyError?.();
    }
  }
  return (
    <div className="share-actions">
      <a className="btn btn--primary btn--block" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener">Enviar pelo WhatsApp</a>
      <button type="button" className="btn btn--primary btn--block" onClick={copy} aria-live="polite">{copied ? "✓ Copiado!" : copyLabel}</button>
    </div>
  );
}
