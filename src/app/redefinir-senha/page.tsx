"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { browserClient } from "@/data/supabase-browser";
import { AbuMascot } from "@/components/brand";

/** Depois do email de "Esqueci minha senha" (link ou código): a pessoa já está com sessão e escolhe a senha nova. */
export default function RedefinirSenhaPage() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("resetPassword");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError(t("tooShort"));
    if (pw !== pw2) return setError(t("mismatch"));
    setBusy(true);
    setError(null);
    const { error: err } = await browserClient().auth.updateUser({ password: pw });
    if (err) {
      setBusy(false);
      return setError(/session|missing/i.test(err.message) ? t("expired") : /password/i.test(err.message) ? t("weak") : t("failed"));
    }
    window.location.assign("/");
  }

  return (
    <div className="sp sp--sheet">
      <header className="sp-top">
        <div className="sp-top__emblem" style={{ width: 120, height: 120, borderRadius: "50%", background: "var(--paper)", display: "grid", placeItems: "end center", overflow: "hidden" }}><AbuMascot width={96} /></div>
      </header>
      <main className="sp-sheet">
        <form className="stack" onSubmit={save} noValidate>
          <h1 className="sp-sheet__title">{t("title")}</h1>
          <div className="field">
            <label htmlFor="pw">{t("newPassword")}</label>
            <div className="pw-field">
              <input id="pw" type={show ? "text" : "password"} className="input" autoComplete="new-password" placeholder={t("hint")} value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
              <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? t("hideLabel") : t("showLabel")}>{show ? t("hide") : t("show")}</button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="pw2">{t("repeat")}</label>
            <input id="pw2" type={show ? "text" : "password"} className="input" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <button type="submit" className="sp-btn sp-btn--main" disabled={busy}>{busy ? t("saving") : t("save")}</button>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
        </form>
      </main>
    </div>
  );
}
