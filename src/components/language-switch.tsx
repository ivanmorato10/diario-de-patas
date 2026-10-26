"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { LOCALES, LOCALE_NAMES, type AppLocale } from "@/i18n/locale";
import { PrefsSaveError, usePreferenceSaver } from "./locale-sync";

/**
 * "Idioma / Language": o rótulo aparece nos dois idiomas, e cada opção no próprio idioma.
 * Antes do login grava o cookie; com conta, grava o perfil primeiro e só então troca a tela (se falhar, avisa e
 * oferece tentar de novo, sem mudar nada). Trocar não recarrega a página.
 */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const { save, busy, failed, retry } = usePreferenceSaver();
  // O idioma tocado fica marcado NA HORA, com o indicador, até a tela trocar de idioma (antes, a marca só mudava
  // depois de gravar e recarregar os textos, e parecia que o toque não tinha pegado). Falhou: a marca volta.
  const [pending, setPending] = useState<AppLocale | null>(null);
  useEffect(() => setPending(null), [locale]);
  const shown = pending ?? locale;
  function pick(l: AppLocale) {
    if (l === shown || busy || pending) return;
    setPending(l);
    void save({ locale: l }).then((ok) => { if (!ok) setPending(null); });
    setTimeout(() => setPending((p) => (p === l ? null : p)), 8000); // nunca fica preso marcando
  }
  return (
    <div className={`lang-switch${compact ? " lang-switch--compact" : ""}`} role="radiogroup" aria-label="Idioma / Language">
      {compact ? null : <span className="lang-switch__label" aria-hidden="true">Idioma / Language</span>}
      <div className="filter-row">
        {LOCALES.map((l) => (
          <button key={l} type="button" role="radio" aria-checked={l === shown} lang={l} disabled={busy || !!pending}
            className={`filter-chip${l === shown ? " is-active" : ""}`} onClick={() => pick(l)} aria-busy={pending === l ? "true" : undefined}>
            {pending === l ? <span className="sp-spinner chip-spinner" aria-hidden="true" /> : null}
            {compact ? (l === "en" ? "English" : "Português") : LOCALE_NAMES[l]}
          </button>
        ))}
      </div>
      <PrefsSaveError failed={failed} retry={retry} busy={busy} />
    </div>
  );
}
