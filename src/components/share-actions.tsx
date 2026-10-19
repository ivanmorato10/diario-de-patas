"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Par padrão "Enviar pelo WhatsApp" + "Copiar" (com "✓ Copiado!"): mesmo estilo, mesma largura e altura,
 * um embaixo do outro. Usado no convite da família e no "Indicar o app".
 */
export function ShareActions({ text, copyLabel, onCopyError }: { text: string; copyLabel?: string; onCopyError?: () => void }) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("shareActions");
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
      <a className="btn btn--primary btn--block" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener">{t("whatsapp")}</a>
      <button type="button" className="btn btn--primary btn--block" onClick={copy} aria-live="polite">{copied ? t("copied") : copyLabel ?? t("copyInvite")}</button>
    </div>
  );
}
