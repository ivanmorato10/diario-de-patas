"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { REAL_MODE, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config/mode";
import { browserClient } from "@/data/supabase-browser";
import { LogoCard } from "@/components/brand";
import { IconInfo } from "@/components/icons";

/**
 * Splash + entrada (primeira tela do app no modo real): logo, depois as opções de conta.
 * Google (Gmail) e Apple (iCloud) por OAuth; email com link/código como alternativa.
 * Quem entra sem diário segue para a apresentação (/bem-vindo); quem já tem vai para Hoje.
 */
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

type Provider = "google" | "apple";
const PROVIDER_NAME: Record<Provider, string> = { google: "Google", apple: "Apple" };

const ERRORS: Record<string, string> = {
  link: "Esse link não funcionou ou já foi usado. Tente entrar de novo.",
  oauth: "Não deu para entrar com essa conta agora. Tente de novo ou use o email.",
};

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.65zM14.1 5.85c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.76-.96 2.8 1.01.08 2.05-.52 2.68-1.28z" />
    </svg>
  );
}

function Entrar() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<"choose" | "email" | "sent">("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<Provider | "email" | null>(null);
  const [enabled, setEnabled] = useState<Record<Provider, boolean> | null>(null);
  const [error, setError] = useState<string | null>(ERRORS[params.get("erro") ?? ""] ?? null);

  // Quais provedores estão ligados no Supabase (para avisar em vez de mostrar uma página de erro).
  useEffect(() => {
    if (!REAL_MODE) return;
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } })
      .then((r) => r.json())
      .then((s) => setEnabled({ google: !!s?.external?.google, apple: !!s?.external?.apple }))
      .catch(() => setEnabled({ google: true, apple: true }));
  }, []);

  if (!REAL_MODE) {
    return (
      <main className="main main--bare stack-lg" style={{ paddingTop: 32 }}>
        <h1>Contas ainda não estão ativas</h1>
        <p className="muted">Por enquanto o diário fica salvo só neste aparelho.</p>
        <Link href="/bem-vindo" className="btn btn--secondary">Voltar</Link>
      </main>
    );
  }

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

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

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return setError("Confira o email.");
    setBusy("email");
    setError(null);
    const { error: err } = await browserClient().auth.signInWithOtp({ email: addr, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
    setBusy(null);
    if (err) setError(err.status === 429 ? "Muitos pedidos seguidos. Espere um minuto e tente de novo." : "Não conseguimos enviar o email agora. Tente de novo.");
    else setMode("sent");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);
    const { error: err } = await browserClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(null);
    if (err) setError("Código inválido ou vencido. Peça um novo.");
    else window.location.assign(next);
  }

  return (
    <main className="main main--bare splash">
      <div className="splash__hero">
        <div className="intro-halo" aria-hidden="true" />
        <div className="anim-pop"><div className="anim-float"><LogoCard width={210} /></div></div>
      </div>

      {mode === "choose" ? (
        <div className="stack splash__actions">
          <h1 className="anim-rise">Guarde a história do seu cachorro</h1>
          <p className="muted anim-rise-2">Entre para o diário ficar salvo na sua conta e aparecer em qualquer aparelho.</p>
          <div className="stack anim-rise-3" style={{ gap: 10 }}>
            <button type="button" className="btn btn--block btn--provider" onClick={() => oauth("google")} disabled={!!busy}>
              <GoogleLogo /> {busy === "google" ? "Abrindo o Google…" : "Continuar com Google"}
            </button>
            <button type="button" className="btn btn--block btn--provider btn--apple" onClick={() => oauth("apple")} disabled={!!busy}>
              <AppleLogo /> {busy === "apple" ? "Abrindo a Apple…" : "Continuar com Apple"}
            </button>
            <div className="splash__or" aria-hidden="true"><span>ou</span></div>
            <button type="button" className="btn btn--secondary btn--block" onClick={() => { setError(null); setMode("email"); }} disabled={!!busy}>
              Entrar com email
            </button>
          </div>
          <p className="caption">Gmail, iCloud ou qualquer email. Sem senha. O diário é privado até você compartilhar.</p>
        </div>
      ) : mode === "email" ? (
        <form className="stack splash__actions" onSubmit={send} noValidate>
          <h1>Entrar com email</h1>
          <p className="muted">Sem senha: mandamos um link de entrada para o seu email. Se é a primeira vez, a conta é criada na hora.</p>
          <div className="field">
            <label htmlFor="email">Seu email</label>
            <input id="email" type="email" className="input" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={!!busy}>{busy === "email" ? "Enviando…" : "Receber link de entrada"}</button>
          <button type="button" className="btn btn--ghost" onClick={() => { setError(null); setMode("choose"); }}>Voltar</button>
        </form>
      ) : (
        <div className="stack splash__actions">
          <h1>Confira seu email</h1>
          <p>Enviamos um link para <strong>{email.trim()}</strong>. Abra o email <strong>neste mesmo aparelho e navegador</strong> e toque no link para entrar.</p>
          <p className="notice notice--info small"><IconInfo size={18} /><span>Não chegou? Veja a caixa de spam. O link vale por 1 hora.</span></p>
          <details className="card" style={{ padding: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, minHeight: 32 }}>O email trouxe um código?</summary>
            <form className="stack" onSubmit={verify} style={{ marginTop: 8 }}>
              <div className="field">
                <label htmlFor="code">Código</label>
                <input id="code" className="input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} />
              </div>
              <button type="submit" className="btn btn--secondary btn--block" disabled={!!busy || code.length < 6}>Entrar com o código</button>
            </form>
          </details>
          <button type="button" className="btn btn--ghost" onClick={() => { setMode("email"); setCode(""); }}>Usar outro email</button>
        </div>
      )}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </main>
  );
}

export default function EntrarPage() {
  return (
    <Suspense fallback={null}>
      <Entrar />
    </Suspense>
  );
}
