"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { CONFIG_OK, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config/mode";
import { browserClient } from "@/data/supabase-browser";
import { isNativeApp, NATIVE_AUTH_CALLBACK, openNativeAuth } from "@/lib/native";
import { AbuMascot, PawDiaryNote } from "@/components/brand";
import { LanguageSwitch } from "@/components/language-switch";
import { useErrorText } from "@/i18n/use-error";
import { IconInfo, Paw } from "@/components/icons";
import { InstallAppLink, isStandalone } from "@/components/install-app";
import { inviteFormatError } from "@/data/family-client";

/**
 * Splash + entrada (primeira tela do app no modo real), nas cores do logo (verde-água, marrom, creme).
 * 1) Splash: Abu com anéis pulsando, "Criar conta" e "Já tenho conta".
 * 2) Folha de entrada: Google (Gmail), Apple (iCloud), email com senha ou com link/código.
 * 3) Convite da família: leva para /convite (cada pessoa usa a própria conta).
 * Conta nova sem diário vai para /adicionar: cadastrar um cachorro (apresentação + /comecar) ou usar um convite.
 */
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

type Provider = "google" | "apple";
type Step = "splash" | "choose" | "email" | "otp" | "sent" | "invite";
type Sent = "otp" | "signup" | "recovery";
type Intent = "criar" | "entrar";
const PROVIDER_NAME: Record<Provider, string> = { google: "Google", apple: "Apple" };

/** ?erro= da volta do login → chave do texto. */
const ERRORS: Record<string, string> = { link: "auth.errors.link", oauth: "auth.errors.oauth" };

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

function Spinner() {
  return <span className="sp-spinner" aria-hidden="true" />;
}

/** Fundo animado: manchas suaves, pegadas atravessando a tela. Só decoração. */
function Backdrop() {
  return (
    <div className="sp-bg" aria-hidden="true">
      <span className="sp-blob sp-blob--1" />
      <span className="sp-blob sp-blob--2" />
      <span className="sp-blob sp-blob--3" />
      <div className="sp-trail">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.45}s`, left: `${6 + i * 12}%`, top: `${78 - i * 9 + (i % 2 ? 4 : -4)}%` }}><Paw size={22} /></span>
        ))}
      </div>
    </div>
  );
}

/** Abu dentro de anéis que pulsam e de uma costura girando (como a borda de um caderno). */
function Emblem({ size = 196 }: { size?: number }) {
  return (
    <div className="sp-emblem" style={{ width: size, height: size }}>
      {[0, 1, 2].map((i) => <span key={i} className="sp-ring" style={{ animationDelay: `${i * 1.1}s` }} />)}
      <span className="sp-stitch" />
      <span className="sp-arc" />
      <div className="sp-disc">
        <AbuMascot width={Math.round(size * 0.62)} className="sp-abu" />
      </div>
    </div>
  );
}

function Entrar() {
  const params = useSearchParams();
  const t = useTranslations("auth");
  const errText = useErrorText();
  const locale = useLocale();
  const rich = { strong: (c: React.ReactNode) => <strong>{c}</strong> };
  const next = safeNext(params.get("next"));
  const initialErrorKey = ERRORS[params.get("erro") ?? ""] ?? null;
  const [step, setStep] = useState<Step>(initialErrorKey || params.get("modo") ? "choose" : "splash");
  const [intent, setIntent] = useState<Intent>(params.get("modo") === "criar" ? "criar" : "entrar");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [sent, setSent] = useState<Sent>("otp");
  const [busy, setBusy] = useState<Provider | "email" | null>(null);
  const [enabled, setEnabled] = useState<Record<Provider, boolean> | null>(null);
  const [errorKey, setError] = useState<string | null>(initialErrorKey);
  const error = errorKey ? errText(errorKey) : null;

  // Quais provedores estão ligados no Supabase (para avisar em vez de mostrar uma página de erro).
  useEffect(() => {
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } })
      .then((r) => r.json())
      .then((s) => setEnabled({ google: !!s?.external?.google, apple: !!s?.external?.apple }))
      .catch(() => setEnabled({ google: true, apple: true }));
  }, []);

  if (!CONFIG_OK) {
    return (
      <main className="main main--bare stack-lg" style={{ paddingTop: 32 }}>
        <h1>Diário de Patas</h1>
        <p className="muted">{errText("shell.appUnavailable")}</p>
      </main>
    );
  }

  // O destino depois do login vai num cookie curto, não na URL de retorno: o Google/Supabase devolvem só o código.
  const redirectTo = (dest = next) => {
    document.cookie = `ddp_next=${encodeURIComponent(dest)}; path=/auth; max-age=900; samesite=lax; secure`;
    return `${window.location.origin}/auth/callback`;
  };
  const go = (s: Step, i?: Intent) => {
    setError(null);
    if (i) setIntent(i);
    setStep(s);
  };

  async function oauth(p: Provider) {
    setError(null);
    if (enabled && !enabled[p]) return setError(`auth.errors.providerOff?provider=${PROVIDER_NAME[p]}`);
    setBusy(p);
    // App do iPhone: o Google não deixa entrar dentro do app; abre no navegador do sistema e volta pelo app.
    const native = isNativeApp();
    if (native) redirectTo(); // guarda o destino (cookie) antes de sair
    const { data, error: err } = await browserClient().auth.signInWithOAuth({
      provider: p, options: native ? { redirectTo: NATIVE_AUTH_CALLBACK, skipBrowserRedirect: true } : { redirectTo: redirectTo() },
    });
    if (!err && native && data?.url) {
      await openNativeAuth(data.url).catch(() => setError(ERRORS.oauth));
      setBusy(null);
      return;
    }
    if (err) {
      setBusy(null);
      setError(ERRORS.oauth);
    }
  }

  const validEmail = () => {
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { setError("auth.errors.checkEmail"); return null; }
    return addr;
  };
  const tooMany = "auth.errors.tooMany";

  /** Código/link no email, sem senha. */
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const addr = validEmail();
    if (!addr) return;
    setBusy("email");
    setError(null);
    // Conta nova: o idioma vai junto (os emails do login usam user_metadata.locale).
    const { error: err } = await browserClient().auth.signInWithOtp({ email: addr, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true, data: { locale } } });
    setBusy(null);
    if (err) setError(err.status === 429 ? tooMany : "auth.errors.sendFailed");
    else { setSent("otp"); setStep("sent"); }
  }

  /** Email e senha: cria a conta (confirmando o email) ou entra. */
  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    const addr = validEmail();
    if (!addr) return;
    if (pw.length < 8) return setError("auth.errors.passwordShort");
    setBusy("email");
    setError(null);
    const sb = browserClient();
    if (creating) {
      const { data, error: err } = await sb.auth.signUp({ email: addr, password: pw, options: { emailRedirectTo: redirectTo(), data: { locale } } });
      setBusy(null);
      if (err) return setError(err.status === 429 ? tooMany : /registered|exists/i.test(err.message) ? "auth.errors.emailExists" : /password/i.test(err.message) ? "auth.errors.weakPassword" : "auth.errors.createFailed");
      if (data.session) return window.location.assign(next);
      // O Supabase não revela se o email já existe: devolve um usuário sem identidades.
      if (data.user && data.user.identities?.length === 0) return setError("auth.errors.emailExistsForgot");
      setSent("signup");
      setStep("sent");
    } else {
      const { error: err } = await sb.auth.signInWithPassword({ email: addr, password: pw });
      if (err) {
        setBusy(null);
        return setError(err.status === 429 ? tooMany : /confirm/i.test(err.message) ? "auth.errors.confirmFirst" : "auth.errors.wrongPassword");
      }
      window.location.assign(next);
    }
  }

  async function forgot() {
    const addr = validEmail();
    if (!addr) return;
    setBusy("email");
    setError(null);
    const { error: err } = await browserClient().auth.resetPasswordForEmail(addr, { redirectTo: redirectTo("/redefinir-senha") });
    setBusy(null);
    if (err) setError(err.status === 429 ? tooMany : "auth.errors.sendFailed");
    else { setSent("recovery"); setStep("sent"); }
  }

  function redeem(e: React.FormEvent) {
    e.preventDefault();
    const bad = inviteFormatError(invite);
    if (bad) return setError(bad);
    window.location.assign(`/convite?codigo=${encodeURIComponent(invite)}`);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);
    const type = sent === "signup" ? "signup" : sent === "recovery" ? "recovery" : "email";
    const { error: err } = await browserClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type });
    setBusy(null);
    if (err) setError("auth.errors.badCode");
    else window.location.assign(sent === "recovery" ? "/redefinir-senha" : next);
  }

  const creating = intent === "criar";

  return (
    <div className={`sp ${step === "splash" ? "" : "sp--sheet"}`}>
      <Backdrop />

      {step === "splash" ? (
        <main className="sp-splash">
          <div className="sp-in sp-in--1"><Emblem /></div>
          <div className="sp-brand sp-in sp-in--2">
            <span className="sp-brand__name">Diário de Patas</span>
            <span className="sp-brand__tag">Sempre Juntos</span>
            <PawDiaryNote className="sp-brand__en" />
          </div>
          <div className="sp-in sp-in--3">
            <div className="sp-note">
              <span className="sp-note__tape" aria-hidden="true" />
              <h1 className="sp-headline">{t("headline")}<Paw size={22} className="sp-note__paw" /></h1>
              <p className="sp-sub">{t("sub")}</p>
            </div>
          </div>
          <div className="sp-ctas sp-in sp-in--4">
            <button type="button" className="sp-btn sp-btn--main" onClick={() => go("choose", "criar")}>
              <Paw size={20} /> {t("registerDog")}
            </button>
            <button type="button" className="sp-btn sp-btn--ghost" onClick={() => go("choose", "entrar")}>{t("haveAccount")}</button>
            <button type="button" className="sp-invite-link" onClick={() => go("invite")}>{t("haveInvite")}</button>
          </div>
          <p className="sp-foot sp-in sp-in--5">{t("foot")}</p>
          <div className="sp-in sp-in--5"><InstallAppLink variant="splash" /></div>
          <div className="sp-in sp-in--5 sp-lang"><LanguageSwitch compact /></div>
        </main>
      ) : (
        <>
          <header className="sp-top">
            <button type="button" className="sp-back" onClick={() => go(step === "choose" || step === "invite" ? "splash" : step === "otp" ? "email" : "choose")} aria-label={t("back")}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className="sp-top__emblem"><Emblem size={150} /></div>
          </header>

          <main className="sp-sheet" key={step}>
            {step === "choose" ? (
              <div className="stack">
                <h1 className="sp-sheet__title">{creating ? t("chooseCreateTitle") : t("chooseSignInTitle")}</h1>
                <p className="muted">{creating ? t("chooseCreateText") : t("chooseSignInText")}</p>
                <div className="stack" style={{ gap: 10, marginTop: 4 }}>
                  <button type="button" className="sp-btn sp-btn--google" onClick={() => oauth("google")} disabled={!!busy}>
                    {busy === "google" ? <Spinner /> : <GoogleLogo />} {busy === "google" ? t("openingGoogle") : t("continueGoogle")}
                  </button>
                  <button type="button" className="sp-btn sp-btn--apple" onClick={() => oauth("apple")} disabled={!!busy}>
                    {busy === "apple" ? <Spinner /> : <AppleLogo />} {busy === "apple" ? t("openingApple") : t("continueApple")}
                  </button>
                  <div className="sp-or" aria-hidden="true"><span>{t("or")}</span></div>
                  <button type="button" className="sp-btn sp-btn--email" onClick={() => go("email")} disabled={!!busy}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
                    {creating ? t("createWithEmail") : t("signInWithEmail")}
                  </button>
                </div>
                <p className="caption" style={{ textAlign: "center" }}>{t("anyEmail")}</p>
                <p className="sp-switch">
                  {creating ? t("alreadyHave") : t("noAccountYet")}{" "}
                  <button type="button" onClick={() => go("choose", creating ? "entrar" : "criar")}>{creating ? t("signIn") : t("createAccount")}</button>
                </p>
              </div>
            ) : step === "invite" ? (
              <form className="stack" onSubmit={redeem} noValidate>
                <h1 className="sp-sheet__title">{t("inviteTitle")}</h1>
                <p className="muted">{t("inviteText")}</p>
                <div className="field">
                  <label htmlFor="invite">{t("code")}</label>
                  <input id="invite" className="input sp-code" style={{ letterSpacing: "0.12em", fontSize: "1.3rem" }} autoCapitalize="characters" autoComplete="one-time-code" placeholder="PATA-XXXX-XXXX" value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase().slice(0, 16))} autoFocus />
                </div>
                <button type="submit" className="sp-btn sp-btn--main">{t("seeInvite")}</button>
              </form>
            ) : step === "email" ? (
              <form className="stack" onSubmit={withPassword} noValidate>
                <h1 className="sp-sheet__title">{creating ? t("emailCreateTitle") : t("signInWithEmail")}</h1>
                <div className="field">
                  <label htmlFor="email">{t("yourEmail")}</label>
                  <input id="email" type="email" className="input" autoComplete="email" inputMode="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <div className="field">
                  <label htmlFor="senha">{creating ? t("createPassword") : t("password")}</label>
                  <div className="pw-field">
                    <input id="senha" type={showPw ? "text" : "password"} className="input" autoComplete={creating ? "new-password" : "current-password"} placeholder={creating ? t("passwordHint") : ""} value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required />
                    <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? t("hidePasswordLabel") : t("showPasswordLabel")}>{showPw ? t("hide") : t("show")}</button>
                  </div>
                </div>
                <button type="submit" className="sp-btn sp-btn--main" disabled={!!busy}>{busy === "email" ? <><Spinner /> {creating ? t("creating") : t("signingIn")}</> : creating ? t("createAccount") : t("signIn")}</button>
                {!creating ? <button type="button" className="sp-link" onClick={forgot} disabled={!!busy}>{t("forgot")}</button> : <p className="caption" style={{ textAlign: "center" }}>{t("confirmCodeNote")}</p>}
                <div className="sp-or" aria-hidden="true"><span>{t("or")}</span></div>
                <button type="button" className="sp-btn sp-btn--email" onClick={() => go("otp")} disabled={!!busy}>{t("preferCode")}</button>
              </form>
            ) : step === "otp" ? (
              <form className="stack" onSubmit={send} noValidate>
                <h1 className="sp-sheet__title">{t("otpTitle")}</h1>
                <p className="muted">{t("otpText")}</p>
                <div className="field">
                  <label htmlFor="email-otp">{t("yourEmail")}</label>
                  <input id="email-otp" type="email" className="input" autoComplete="email" inputMode="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <button type="submit" className="sp-btn sp-btn--main" disabled={!!busy}>{busy === "email" ? <><Spinner /> {t("sending")}</> : t("getCode")}</button>
              </form>
            ) : (
              <div className="stack">
                <div className="sp-mail" aria-hidden="true">
                  <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
                </div>
                <h1 className="sp-sheet__title">{sent === "recovery" ? t("sentRecoveryTitle") : sent === "signup" ? t("sentSignupTitle") : t("sentTitle")}</h1>
                {isStandalone() ? (
                  <p>{t.rich("sentStandalone", { ...rich, email: email.trim() })}</p>
                ) : (
                  <p>{t.rich("sentBrowser", { ...rich, email: email.trim() })}</p>
                )}
                <form className="stack" onSubmit={verify}>
                  <div className="field">
                    <label htmlFor="code">{t("code")}</label>
                    <input id="code" className="input sp-code" inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} />
                  </div>
                  <button type="submit" className="sp-btn sp-btn--main" disabled={!!busy || code.length < 6}>{sent === "recovery" ? t("continue") : sent === "signup" ? t("confirmAndEnter") : t("enterWithCode")}</button>
                </form>
                <p className="notice notice--info small"><IconInfo size={18} /><span>{t("notArrived")}</span></p>
                <button type="button" className="btn btn--ghost" onClick={() => { setStep(sent === "otp" ? "otp" : "email"); setCode(""); }}>{t("otherEmail")}</button>
              </div>
            )}
            {error ? <p className="field-error" role="alert" style={{ marginTop: 12 }}>{error}</p> : null}
          </main>
        </>
      )}
    </div>
  );
}

export default function EntrarPage() {
  return (
    <Suspense fallback={null}>
      <Entrar />
    </Suspense>
  );
}
