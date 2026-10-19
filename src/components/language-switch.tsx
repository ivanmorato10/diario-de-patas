"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { LOCALES, LOCALE_NAMES, type AppLocale } from "@/i18n/locale";
import { useSetPreferences } from "./locale-sync";

/**
 * "Idioma / Language": o rótulo aparece nos dois idiomas, e cada opção no próprio idioma.
 * Antes do login grava o cookie; com conta, também o perfil. Trocar não recarrega a página.
 */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const setPrefs = useSetPreferences();
  const [busy, setBusy] = useState(false);
  async function pick(l: AppLocale) {
    if (l === locale || busy) return;
    setBusy(true);
    try { await setPrefs({ locale: l }); } finally { setBusy(false); }
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
    </div>
  );
}
