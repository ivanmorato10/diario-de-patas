"use client";

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
  function pick(l: AppLocale) {
    if (l === locale || busy) return;
    void save({ locale: l });
  }
  return (
    <div className={`lang-switch${compact ? " lang-switch--compact" : ""}`} role="radiogroup" aria-label="Idioma / Language">
      {compact ? null : <span className="lang-switch__label" aria-hidden="true">Idioma / Language</span>}
      <div className="filter-row">
        {LOCALES.map((l) => (
          <button key={l} type="button" role="radio" aria-checked={l === locale} lang={l} disabled={busy}
            className={`filter-chip${l === locale ? " is-active" : ""}`} onClick={() => pick(l)}>
            {compact ? (l === "en" ? "English" : "Português") : LOCALE_NAMES[l]}
          </button>
        ))}
      </div>
      <PrefsSaveError failed={failed} retry={retry} busy={busy} />
    </div>
  );
}
