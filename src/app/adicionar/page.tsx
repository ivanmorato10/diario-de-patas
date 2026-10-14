"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { AbuMascot } from "@/components/brand";
import { Paw } from "@/components/icons";

/**
 * Adicionar cachorro: um caminho só, para conta nova e para quem já tem diário.
 * 1) Cadastrar um cachorro (diário novo, a pessoa vira administradora).
 * 2) Entrar no diário de alguém com o código de convite da família.
 */
export default function Adicionar() {
  const { snap } = useStore();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const hasDog = !!snap?.dog;
  const ok = code.replace(/[^A-Z0-9]/g, "").replace(/^PATA/, "").length === 8;

  return (
    <div className="sp sp--sheet">
      <header className="sp-top">
        {hasDog ? (
          <Link href="/hoje" className="sp-back" aria-label="Voltar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
        ) : null}
        <div className="sp-top__emblem" style={{ width: 120, height: 120, borderRadius: "50%", background: "var(--paper)", display: "grid", placeItems: "end center", overflow: "hidden" }}><AbuMascot width={96} /></div>
      </header>
      <main className="sp-sheet">
        <div className="stack">
          <h1 className="sp-sheet__title">{hasDog ? "Adicionar cachorro" : "Qual é o seu caso?"}</h1>
          <p className="page-note">{hasDog ? "Mais um amigo na família? Crie um diário para ele ou entre no diário que alguém compartilhou com você." : "Você pode criar o diário do seu cachorro ou entrar no diário que alguém da família já criou."}</p>

          <Link href={hasDog ? "/comecar?novo=1" : "/bem-vindo"} className="choice-card">
            <span className="choice-card__icon" aria-hidden="true">🐶</span>
            <span className="choice-card__text"><strong>Cadastrar um cachorro</strong><span>Crio um diário novo e convido a família depois.</span></span>
          </Link>

          <div className={`choice-card choice-card--form${open ? " is-open" : ""}`}>
            <button type="button" className="choice-card__head" onClick={() => setOpen(true)} aria-expanded={open}>
              <span className="choice-card__icon" aria-hidden="true">🎟️</span>
              <span className="choice-card__text"><strong>Tenho um código de convite</strong><span>Alguém da família me convidou para o diário do cachorro dele.</span></span>
            </button>
            {open ? (
              <form className="stack" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); if (ok) router.push(`/convite?codigo=${encodeURIComponent(code)}`); }}>
                <label htmlFor="codigo" className="caption">Código do convite</label>
                <input id="codigo" className="input sp-code" style={{ letterSpacing: "0.12em", fontSize: "1.3rem" }} autoCapitalize="characters" autoComplete="off" placeholder="PATA-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 16))} autoFocus />
                <button type="submit" className="sp-btn sp-btn--main" disabled={!ok}><Paw size={18} /> Ver convite</button>
              </form>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
