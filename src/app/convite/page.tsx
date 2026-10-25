"use client";

import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/i18n/use-error";
import { useRouter, useSearchParams } from "next/navigation";
import { browserClient } from "@/data/supabase-browser";
import { useStore } from "@/data/store";
import { acceptInvite, inviteFormatError, previewInvite } from "@/data/family-client";
import type { DiaryRole } from "@/domain/types";
import { AbuMascot } from "@/components/brand";
import { Paw } from "@/components/icons";

/**
 * Convite de família: mostra de quem é o diário e o papel; quem recebe entra com a PRÓPRIA conta
 * (ou cria uma) e aceita. Não precisa cadastrar cachorro: o convite já leva ao diário.
 */
function Convite() {
  const params = useSearchParams();
  const router = useRouter();
  const { reload, snap } = useStore();
  const [myName, setMyName] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const nameValue = myName ?? (snap?.me?.nameConfirmed ? snap.me.name : snap?.me?.suggestedName || guess);
  const [code, setCode] = useState(params.get("codigo") ?? "");
  const [info, setInfo] = useState<{ dogName: string; invitedBy: string; role: DiaryRole } | null>(null);
  const [logged, setLogged] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setError] = useState<string | null>(null);
  const t = useTranslations("invite");
  const tf = useTranslations("family");
  const errText = useErrorText();
  const error = errorKey ? errText(errorKey) : null;

  useEffect(() => {
    browserClient().auth.getUser().then(({ data }) => {
      setLogged(!!data.user);
      // Palpite do nome pelo login (Google/Apple); a pessoa confirma ou corrige.
      const meta = data.user?.user_metadata ?? {};
      const n = String(meta.full_name || meta.name || meta.given_name || "").trim().split(/\s+/)[0] ?? "";
      if (n) setGuess(n.slice(0, 40));
    }).catch(() => setLogged(false));
  }, []);

  async function look(c = code) {
    const bad = inviteFormatError(c);
    if (bad) return setError(bad);
    setError(null);
    setBusy(true);
    try { setInfo(await previewInvite(c)); } catch (e) { setInfo(null); setError(e instanceof Error ? e.message : "family.errors.invalid"); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (params.get("codigo")) void look(params.get("codigo")!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(code, nameValue.trim() || undefined); // sem nome: fica o palpite e o app pergunta depois
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "errors.acceptFailed");
      return;
    }
    // Entrou: abre o diário; se a conferência falhar, abre o app do zero (nunca diz "não entrou" depois de entrar).
    try { await reload(); router.replace("/hoje"); } catch { window.location.assign("/hoje"); }
  }

  const next = encodeURIComponent(`/convite?codigo=${encodeURIComponent(code)}`);

  return (
    <div className="sp sp--sheet">
      <header className="sp-top">
        <button type="button" className="sp-back" aria-label={t("back")} onClick={() => (info ? (setInfo(null), setError(null)) : window.history.length > 1 ? router.back() : router.replace("/"))}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="sp-top__emblem" style={{ width: 120, height: 120, borderRadius: "50%", background: "var(--paper)", display: "grid", placeItems: "end center", overflow: "hidden" }}><AbuMascot width={96} /></div>
      </header>
      <main className="sp-sheet">
        {!info ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void look(); }}>
            <h1 className="sp-sheet__title">{t("title")}</h1>
            <p className="page-note">{t("text")}</p>
            <div className="field">
              <label htmlFor="codigo">{t("code")}</label>
              <input id="codigo" className="input sp-code" style={{ letterSpacing: "0.12em", fontSize: "1.3rem" }} autoCapitalize="characters" placeholder="PATA-XXXX-XXXX" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 16)); setError(null); }} autoFocus />
            </div>
            {error ? <p className="field-error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
            <button type="submit" className="sp-btn sp-btn--main" disabled={busy}>{busy ? t("checking") : t("see")}</button>
          </form>
        ) : (
          <div className="stack">
            <h1 className="sp-sheet__title">{t("invitedYou", { person: info.invitedBy, dog: info.dogName })}</h1>
            <p className="invite-role"><Paw size={16} /> {t.rich("yourRole", { role: tf(`roles.${info.role}`), strong: (c) => <strong>{c}</strong> })}</p>
            <p className="caption" style={{ marginTop: -6 }}>{tf(`roleHelp.${info.role}`)}</p>
            {logged ? (
              <>
              <div className="field">
                <label htmlFor="meu-nome">{t("yourName")} <span className="muted">{t("yourNameHint")}</span></label>
                <input id="meu-nome" className="input" value={nameValue} maxLength={40} autoComplete="given-name" placeholder={t("yourName")} onChange={(e) => setMyName(e.target.value)} />
              </div>
              <button type="button" className="sp-btn sp-btn--main" onClick={accept} disabled={busy}>{busy ? t("entering") : t("accept", { dog: info.dogName })}</button>
              </>
            ) : (
              <>
                <p className="page-note">{t("signInToAccept")}</p>
                <a className="sp-btn sp-btn--main" href={`/entrar?modo=criar&next=${next}`}>{t("createMine")}</a>
                <a className="sp-btn sp-btn--ghost" href={`/entrar?modo=entrar&next=${next}`}>{t("haveAccount")}</a>
              </>
            )}
          </div>
        )}
        {error && info ? <p className="field-error" role="alert" style={{ marginTop: 12 }}>{error}</p> : null}
      </main>
    </div>
  );
}

export default function ConvitePage() {
  return (
    <Suspense fallback={null}>
      <Convite />
    </Suspense>
  );
}
