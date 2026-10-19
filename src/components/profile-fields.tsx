"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { DogPreferences } from "@/domain/types";

/** Textos em prefs.<chave>.title / .hint. */
const PREF_OPTIONS: (keyof DogPreferences)[] = ["home", "outdoor", "people", "socialDogs"];

export function PreferencesFields({ value, onChange }: { value: DogPreferences; onChange: (v: DogPreferences) => void }) {
  const t = useTranslations("prefs");
  return (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label" style={{ fontWeight: 600, marginBottom: 8 }}>{t("legend")}</legend>
      {PREF_OPTIONS.map((key) => ({ key, title: t(`${key}.title`), hint: t(`${key}.hint`) })).map((o) => (
        <label key={o.key} className="check">
          <input type="checkbox" checked={value[o.key]} onChange={(e) => onChange({ ...value, [o.key]: e.target.checked })} />
          <span className="check__text">
            <span style={{ fontWeight: 600 }}>{o.title}</span>
            <span className="caption">{o.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

const COMMON_TZ = [
  "America/Sao_Paulo", "America/Manaus", "America/Fortaleza", "America/Recife", "America/Belem", "America/Cuiaba",
  "America/Porto_Velho", "America/Rio_Branco", "America/Noronha", "America/Los_Angeles", "America/New_York", "Europe/Lisbon", "UTC",
];

export function TimezoneSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const options = useMemo(() => {
    let all: string[] = COMMON_TZ;
    try {
      const sv = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
      if (sv) all = sv("timeZone");
    } catch { /* usa a lista curta */ }
    return Array.from(new Set([value, ...COMMON_TZ, ...all]));
  }, [value]);
  return (
    <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
    </select>
  );
}
