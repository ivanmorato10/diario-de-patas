"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/i18n/use-error";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { AbuMascot } from "@/components/brand";
import { Paw } from "@/components/icons";
import { inviteFormatError, previewInvite } from "@/data/family-client";
import { NameAsk } from "@/components/name-ask";
import { SignOutForm } from "@/components/sign-out";

/**
 * Adicionar cachorro: um caminho só, para conta nova e para quem já tem diário.
 * 1) Cadastrar um cachorro (diário novo, a pessoa vira administradora).
 * 2) Entrar no diário de alguém com o código de convite da família.
 */
const BACK = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;

export default function Adicionar() {
  const { snap } = useStore();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setError] = useState<string | null>(null);
  const t = useTranslations("add");
  const errText = useErrorText();
  const error = errorKey ? errText(errorKey) : null;
  const hasDog = !!snap?.dog;

  async function check(e: React.FormEvent) {
    e.preventDefault();
    const bad = inviteFormatError(code);
    if (bad) return setError(bad);
    setBusy(true);
    setError(null);
    try {
      await previewInvite(code);
      router.push(`/convite?codigo=${encodeURIComponent(code)}`);
    } catch (er) {
      setBusy(false);
      setError(er instanceof Error ? er.message : "family.errors.invalid");
    }
  }

  return (
    <div className="sp sp--sheet">
      <header className="sp-top">
        {/* Conta nova sem diário: sem seta. Antes ela saía da conta e levava para a tela de entrada no meio do
            cadastro; quem entrou com a conta errada usa o "Sair" lá embaixo. */}
        {hasDog ? <Link href="/hoje" className="sp-back" aria-label={t("back")}>{BACK}</Link> : null}
        <div className="sp-top__emblem" style={{ width: 120, height: 120, borderRadius: "50%", background: "var(--paper)", display: "grid", placeItems: "end center", overflow: "hidden" }}><AbuMascot width={96} /></div>
      </header>
      <main className="sp-sheet">
        <div className="stack">
          {!hasDog ? <NameAsk title={t("nameTitle")} note={t("nameNote")} /> : null}
          <h1 className="sp-sheet__title">{hasDog ? t("titleAnother") : t("titleFirst")}</h1>
          <p className="page-note">{hasDog ? t("noteAnother") : t("noteFirst")}</p>

          <Link href={hasDog ? "/comecar?novo=1" : "/bem-vindo"} className="choice-card">
            <span className="choice-card__icon" aria-hidden="true">🐶</span>
            <span className="choice-card__text"><strong>{t("registerTitle")}</strong><span>{t("registerText")}</span></span>
          </Link>

          <div className={`choice-card choice-card--form${open ? " is-open" : ""}`}>
            <button type="button" className="choice-card__head" onClick={() => setOpen(true)} aria-expanded={open}>
              <span className="choice-card__icon" aria-hidden="true">🎟️</span>
              <span className="choice-card__text"><strong>{t("inviteTitle")}</strong><span>{t("inviteText")}</span></span>
            </button>
            {open ? (
              <form className="stack" style={{ gap: 10 }} onSubmit={check} noValidate>
                <label htmlFor="codigo" className="caption">{t("inviteCode")}</label>
                <input id="codigo" className="input sp-code" style={{ letterSpacing: "0.12em", fontSize: "1.3rem" }} autoCapitalize="characters" autoComplete="off" placeholder="PATA-XXXX-XXXX" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 16)); setError(null); }} aria-invalid={!!error} aria-describedby={error ? "codigo-erro" : undefined} autoFocus />
                {error ? <p id="codigo-erro" className="field-error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
                <button type="submit" className="sp-btn sp-btn--main" disabled={busy}><Paw size={18} /> {busy ? t("checking") : t("seeInvite")}</button>
              </form>
            ) : null}
          </div>
          {!hasDog ? (
            <SignOutForm className="sp-switch" style={{ textAlign: "center" }}>
              {() => <>{t("wrongAccount")} <button type="submit">{t("signOut")}</button></>}
            </SignOutForm>
          ) : null}
        </div>
      </main>
    </div>
  );
}
