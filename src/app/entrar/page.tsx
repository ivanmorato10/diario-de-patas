"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { REAL_MODE } from "@/config/mode";
import { browserClient } from "@/data/supabase-browser";
import { AbuMascot } from "@/components/brand";
import { IconInfo } from "@/components/icons";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/hoje");

function Entrar() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("erro") === "link" ? "Esse link não funcionou ou já foi usado. Peça um novo abaixo." : null);

  if (!REAL_MODE) {
    return (
      <main className="main main--bare stack-lg" style={{ paddingTop: 32 }}>
        <h1>Contas ainda não estão ativas</h1>
        <p className="muted">Por enquanto o diário fica salvo só neste aparelho.</p>
        <Link href="/bem-vindo" className="btn btn--secondary">Voltar</Link>
      </main>
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return setError("Confira o email.");
    setBusy(true);
    setError(null);
    const { error: err } = await browserClient().auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
    });
    setBusy(false);
    if (err) setError(err.status === 429 ? "Muitos pedidos seguidos. Espere um minuto e tente de novo." : "Não conseguimos enviar o email agora. Tente de novo.");
    else setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await browserClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (err) setError("Código inválido ou vencido. Peça um novo.");
    else window.location.assign(next);
  }

  return (
    <main className="main main--bare stack-lg" style={{ paddingTop: 24 }}>
      <div className="intro-visual" style={{ minHeight: 200 }}>
        <div className="intro-halo" aria-hidden="true" />
        <div className="anim-float"><AbuMascot width={150} /></div>
      </div>
      {!sent ? (
        <form className="stack" onSubmit={send} noValidate>
          <h1>Entrar no Diário de Patas</h1>
          <p className="muted">Sem senha: mandamos um link de entrada para o seu email. Se é a primeira vez, a conta é criada na hora.</p>
          <div className="field">
            <label htmlFor="email">Seu email</label>
            <input id="email" type="email" className="input" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{busy ? "Enviando…" : "Receber link de entrada"}</button>
        </form>
      ) : (
        <div className="stack">
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
              <button type="submit" className="btn btn--secondary btn--block" disabled={busy || code.length < 6}>Entrar com o código</button>
            </form>
          </details>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button type="button" className="btn btn--ghost" onClick={() => { setSent(false); setCode(""); }}>Usar outro email</button>
        </div>
      )}
      <p className="caption">Ao entrar, o diário fica guardado na sua conta e aparece em qualquer aparelho. Ele é privado até você compartilhar.</p>
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
