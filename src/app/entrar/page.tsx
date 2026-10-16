"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CONFIG_OK, SUPABASE_ANON_KEY, SUPABASE_URL, UNAVAILABLE_TEXT } from "@/config/mode";
import { browserClient } from "@/data/supabase-browser";
import { AbuMascot } from "@/components/brand";
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

const ERRORS: Record<string, string> = {
  link: "Esse link não funcionou ou já foi usado. Tente entrar de novo.",
  oauth: "Não deu para entrar com essa conta agora. Tente de novo ou use o email.",
};

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
  const next = safeNext(params.get("next"));
  const initialError = ERRORS[params.get("erro") ?? ""] ?? null;
  const [step, setStep] = useState<Step>(initialError || params.get("modo") ? "choose" : "splash");
  const [intent, setIntent] = useState<Intent>(params.get("modo") === "criar" ? "criar" : "entrar");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [sent, setSent] = useState<Sent>("otp");
  const [busy, setBusy] = useState<Provider | "email" | null>(null);
  const [enabled, setEnabled] = useState<Record<Provider, boolean> | null>(null);
  const [error, setError] = useState<string | null>(initialError);

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
        <p className="muted">{UNAVAILABLE_TEXT}</p>
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
    if (enabled && !enabled[p]) return setError(`Entrar com ${PROVIDER_NAME[p]} ainda está sendo configurado. Por enquanto, use o email.`);
    setBusy(p);
    const { error: err } = await browserClient().auth.signInWithOAuth({ provider: p, options: { redirectTo: redirectTo() } });
    if (err) {
      setBusy(null);
      setError(ERRORS.oauth);
    }
  }

  const validEmail = () => {
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { setError("Confira o email."); return null; }
    return addr;
  };
  const tooMany = "Muitos pedidos seguidos. Espere um minuto e tente de novo.";

  /** Código/link no email, sem senha. */
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const addr = validEmail();
    if (!addr) return;
    setBusy("email");
    setError(null);
    const { error: err } = await browserClient().auth.signInWithOtp({ email: addr, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
    setBusy(null);
    if (err) setError(err.status === 429 ? tooMany : "Não conseguimos enviar o email agora. Tente de novo.");
    else { setSent("otp"); setStep("sent"); }
  }

  /** Email e senha: cria a conta (confirmando o email) ou entra. */
  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    const addr = validEmail();
    if (!addr) return;
    if (pw.length < 8) return setError("A senha precisa de pelo menos 8 caracteres.");
    setBusy("email");
    setError(null);
    const sb = browserClient();
    if (creating) {
      const { data, error: err } = await sb.auth.signUp({ email: addr, password: pw, options: { emailRedirectTo: redirectTo() } });
      setBusy(null);
      if (err) return setError(err.status === 429 ? tooMany : /registered|exists/i.test(err.message) ? "Esse email já tem conta. Toque em Entrar." : /password/i.test(err.message) ? "Escolha uma senha mais forte: 8 caracteres ou mais, misturando letras e números." : "Não conseguimos criar a conta agora. Tente de novo.");
      if (data.session) return window.location.assign(next);
      // O Supabase não revela se o email já existe: devolve um usuário sem identidades.
      if (data.user && data.user.identities?.length === 0) return setError("Esse email já tem conta. Toque em Entrar (ou em “Esqueci minha senha”).");
      setSent("signup");
      setStep("sent");
    } else {
      const { error: err } = await sb.auth.signInWithPassword({ email: addr, password: pw });
      if (err) {
        setBusy(null);
        return setError(err.status === 429 ? tooMany : /confirm/i.test(err.message) ? "Falta confirmar o email: abra o email de boas-vindas que enviamos." : "Email ou senha não conferem. Se você sempre entrou pelo Google, Apple ou código no email, use “Esqueci minha senha” para criar uma.");
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
    if (err) setError(err.status === 429 ? tooMany : "Não conseguimos enviar o email agora. Tente de novo.");
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
    if (err) setError("Código inválido ou vencido. Peça um novo.");
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
            <span className="sp-brand__tag">Sempre juntos</span>
          </div>
          <div className="sp-in sp-in--3">
            <div className="sp-note">
              <span className="sp-note__tape" aria-hidden="true" />
              <h1 className="sp-headline">Cada dia com ele vira uma história.<Paw size={22} className="sp-note__paw" /></h1>
              <p className="sp-sub">Fotos, missões, conquistas e cuidados do seu cachorro, guardados num diário só de vocês.</p>
            </div>
          </div>
          <div className="sp-ctas sp-in sp-in--4">
            <button type="button" className="sp-btn sp-btn--main" onClick={() => go("choose", "criar")}>
              <Paw size={20} /> Cadastrar meu cachorro
            </button>
            <button type="button" className="sp-btn sp-btn--ghost" onClick={() => go("choose", "entrar")}>Já tenho conta</button>
            <button type="button" className="sp-invite-link" onClick={() => go("invite")}>🎟️ Tenho um código de convite</button>
          </div>
          <p className="sp-foot sp-in sp-in--5">Grátis · privado até você convidar a família</p>
          <div className="sp-in sp-in--5"><InstallAppLink variant="splash" /></div>
        </main>
      ) : (
        <>
          <header className="sp-top">
            <button type="button" className="sp-back" onClick={() => go(step === "choose" || step === "invite" ? "splash" : step === "otp" ? "email" : "choose")} aria-label="Voltar">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className="sp-top__emblem"><Emblem size={150} /></div>
          </header>

          <main className="sp-sheet" key={step}>
            {step === "choose" ? (
              <div className="stack">
                <h1 className="sp-sheet__title">{creating ? "Vamos criar o diário!" : "Que bom te ver de novo!"}</h1>
                <p className="muted">{creating ? "Primeiro sua conta, depois você apresenta o seu cachorro: nome, foto e pronto." : "Entre do mesmo jeito que você criou a conta."}</p>
                <div className="stack" style={{ gap: 10, marginTop: 4 }}>
                  <button type="button" className="sp-btn sp-btn--google" onClick={() => oauth("google")} disabled={!!busy}>
                    {busy === "google" ? <Spinner /> : <GoogleLogo />} {busy === "google" ? "Abrindo o Google…" : "Continuar com Google"}
                  </button>
                  <button type="button" className="sp-btn sp-btn--apple" onClick={() => oauth("apple")} disabled={!!busy}>
                    {busy === "apple" ? <Spinner /> : <AppleLogo />} {busy === "apple" ? "Abrindo a Apple…" : "Continuar com Apple"}
                  </button>
                  <div className="sp-or" aria-hidden="true"><span>ou</span></div>
                  <button type="button" className="sp-btn sp-btn--email" onClick={() => go("email")} disabled={!!busy}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
                    {creating ? "Criar com email" : "Entrar com email"}
                  </button>
                </div>
                <p className="caption" style={{ textAlign: "center" }}>Gmail, iCloud ou qualquer email, com senha ou com um código no email.</p>
                <p className="sp-switch">
                  {creating ? "Já tem conta? " : "Ainda não tem conta? "}
                  <button type="button" onClick={() => go("choose", creating ? "entrar" : "criar")}>{creating ? "Entrar" : "Criar conta"}</button>
                </p>
              </div>
            ) : step === "invite" ? (
              <form className="stack" onSubmit={redeem} noValidate>
                <h1 className="sp-sheet__title">Convite da família</h1>
                <p className="muted">Quem cuida do diário gerou um código para você. Você vai entrar com a sua própria conta (ou criar uma).</p>
                <div className="field">
                  <label htmlFor="invite">Código</label>
                  <input id="invite" className="input sp-code" style={{ letterSpacing: "0.12em", fontSize: "1.3rem" }} autoCapitalize="characters" autoComplete="one-time-code" placeholder="PATA-XXXX-XXXX" value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase().slice(0, 16))} autoFocus />
                </div>
                <button type="submit" className="sp-btn sp-btn--main">Ver convite</button>
              </form>
            ) : step === "email" ? (
              <form className="stack" onSubmit={withPassword} noValidate>
                <h1 className="sp-sheet__title">{creating ? "Criar conta com email" : "Entrar com email"}</h1>
                <div className="field">
                  <label htmlFor="email">Seu email</label>
                  <input id="email" type="email" className="input" autoComplete="email" inputMode="email" placeholder="voce@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <div className="field">
                  <label htmlFor="senha">{creating ? "Crie uma senha" : "Senha"}</label>
                  <div className="pw-field">
                    <input id="senha" type={showPw ? "text" : "password"} className="input" autoComplete={creating ? "new-password" : "current-password"} placeholder={creating ? "8 caracteres ou mais" : ""} value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required />
                    <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Esconder senha" : "Mostrar senha"}>{showPw ? "Esconder" : "Mostrar"}</button>
                  </div>
                </div>
                <button type="submit" className="sp-btn sp-btn--main" disabled={!!busy}>{busy === "email" ? <><Spinner /> {creating ? "Criando…" : "Entrando…"}</> : creating ? "Criar conta" : "Entrar"}</button>
                {!creating ? <button type="button" className="sp-link" onClick={forgot} disabled={!!busy}>Esqueci minha senha</button> : <p className="caption" style={{ textAlign: "center" }}>Vamos mandar um código para confirmar o email.</p>}
                <div className="sp-or" aria-hidden="true"><span>ou</span></div>
                <button type="button" className="sp-btn sp-btn--email" onClick={() => go("otp")} disabled={!!busy}>Prefiro receber um código no email</button>
              </form>
            ) : step === "otp" ? (
              <form className="stack" onSubmit={send} noValidate>
                <h1 className="sp-sheet__title">Entrar sem senha</h1>
                <p className="muted">Mandamos um código e um link para o seu email. Se for a primeira vez, a conta é criada na hora.</p>
                <div className="field">
                  <label htmlFor="email-otp">Seu email</label>
                  <input id="email-otp" type="email" className="input" autoComplete="email" inputMode="email" placeholder="voce@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <button type="submit" className="sp-btn sp-btn--main" disabled={!!busy}>{busy === "email" ? <><Spinner /> Enviando…</> : "Receber código de entrada"}</button>
              </form>
            ) : (
              <div className="stack">
                <div className="sp-mail" aria-hidden="true">
                  <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
                </div>
                <h1 className="sp-sheet__title">{sent === "recovery" ? "Vamos criar uma senha nova" : sent === "signup" ? "Confirme seu email" : "Confira seu email"}</h1>
                {isStandalone() ? (
                  <p>Enviamos para <strong>{email.trim()}</strong>. <strong>Digite aqui o código do email.</strong> No app instalado, o link do email abre no Safari, e não aqui.</p>
                ) : (
                  <p>Enviamos para <strong>{email.trim()}</strong>. Abra o email <strong>neste mesmo aparelho</strong> e toque no link, ou digite o código abaixo.</p>
                )}
                <form className="stack" onSubmit={verify}>
                  <div className="field">
                    <label htmlFor="code">Código</label>
                    <input id="code" className="input sp-code" inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} />
                  </div>
                  <button type="submit" className="sp-btn sp-btn--main" disabled={!!busy || code.length < 6}>{sent === "recovery" ? "Continuar" : sent === "signup" ? "Confirmar e entrar" : "Entrar com o código"}</button>
                </form>
                <p className="notice notice--info small"><IconInfo size={18} /><span>Não chegou? Veja a caixa de spam. O código vale por 1 hora.</span></p>
                <button type="button" className="btn btn--ghost" onClick={() => { setStep(sent === "otp" ? "otp" : "email"); setCode(""); }}>Usar outro email</button>
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
