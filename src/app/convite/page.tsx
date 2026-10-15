"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { REAL_MODE } from "@/config/mode";
import { browserClient } from "@/data/supabase-browser";
import { useStore } from "@/data/store";
import { ROLE_PT, acceptInvite, inviteFormatError, previewInvite } from "@/data/family-client";
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
  const nameValue = myName ?? (snap?.me?.nameConfirmed ? snap.me.name : snap?.me?.name ?? "");
  const [code, setCode] = useState(params.get("codigo") ?? "");
  const [info, setInfo] = useState<{ dogName: string; invitedBy: string; role: DiaryRole } | null>(null);
  const [logged, setLogged] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!REAL_MODE) return;
    browserClient().auth.getUser().then(({ data }) => setLogged(!!data.user)).catch(() => setLogged(false));
  }, []);

  async function look(c = code) {
    const bad = inviteFormatError(c);
    if (bad) return setError(bad);
    setError(null);
    setBusy(true);
    try { setInfo(await previewInvite(c)); } catch (e) { setInfo(null); setError(e instanceof Error ? e.message : "Convite inválido."); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (params.get("codigo")) void look(params.get("codigo")!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      if (!nameValue.trim()) { setBusy(false); return setError("Conte como a família te chama."); }
      await acceptInvite(code, nameValue);
      await reload();
      router.replace("/hoje");
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Não deu para aceitar o convite.");
    }
  }

  const next = encodeURIComponent(`/convite?codigo=${encodeURIComponent(code)}`);

  return (
    <div className="sp sp--sheet">
      <header className="sp-top">
        <button type="button" className="sp-back" aria-label="Voltar" onClick={() => (info ? (setInfo(null), setError(null)) : window.history.length > 1 ? router.back() : router.replace("/"))}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="sp-top__emblem" style={{ width: 120, height: 120, borderRadius: "50%", background: "var(--paper)", display: "grid", placeItems: "end center", overflow: "hidden" }}><AbuMascot width={96} /></div>
      </header>
      <main className="sp-sheet">
        {!info ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void look(); }}>
            <h1 className="sp-sheet__title">Convite para um diário</h1>
            <p className="page-note">Digite o código que a família mandou para você. Você entra com a sua própria conta.</p>
            <div className="field">
              <label htmlFor="codigo">Código do convite</label>
              <input id="codigo" className="input sp-code" style={{ letterSpacing: "0.12em", fontSize: "1.3rem" }} autoCapitalize="characters" placeholder="PATA-XXXX-XXXX" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 16)); setError(null); }} autoFocus />
            </div>
            {error ? <p className="field-error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
            <button type="submit" className="sp-btn sp-btn--main" disabled={busy}>{busy ? "Conferindo…" : "Ver convite"}</button>
          </form>
        ) : (
          <div className="stack">
            <h1 className="sp-sheet__title">{info.invitedBy} convidou você para o diário de {info.dogName}</h1>
            <p className="invite-role"><Paw size={16} /> Seu papel: <strong>{ROLE_PT[info.role]}</strong>{info.role === "editor" ? " (guardar fotos, missões e cuidados)" : " (ver tudo, sem alterar)"}</p>
            {logged ? (
              <>
              <div className="field">
                <label htmlFor="meu-nome">Como a família te chama?</label>
                <input id="meu-nome" className="input" value={nameValue} maxLength={40} autoComplete="given-name" placeholder="Seu nome" onChange={(e) => setMyName(e.target.value)} />
              </div>
              <button type="button" className="sp-btn sp-btn--main" onClick={accept} disabled={busy}>{busy ? "Entrando…" : `Aceitar e abrir o diário de ${info.dogName}`}</button>
              </>
            ) : (
              <>
                <p className="page-note">Para aceitar, entre com a sua conta. Se ainda não tem, crie uma: é rápido e não precisa cadastrar cachorro.</p>
                <a className="sp-btn sp-btn--main" href={`/entrar?modo=criar&next=${next}`}>Criar minha conta</a>
                <a className="sp-btn sp-btn--ghost" href={`/entrar?modo=entrar&next=${next}`}>Já tenho conta</a>
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
