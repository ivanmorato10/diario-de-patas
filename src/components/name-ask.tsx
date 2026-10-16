"use client";

import { useState } from "react";
import { useStore } from "@/data/store";
import { setMyName } from "@/data/letters-client";

/**
 * "Qual é o seu nome?" (da PESSOA, não do cachorro) — aparece em "guardada por", "cartinha de" e nos ossinhos.
 * Vem preenchido com o palpite (Google/Apple/email); a pessoa confirma ou corrige uma vez.
 */
export function NameAsk({ title = "Qual é o seu nome?", note = "O seu, de humano 🙂 A família vê nas fotos e cartinhas." }: { title?: string; note?: string }) {
  const { snap, reload } = useStore();
  const [name, setName] = useState(snap?.me?.suggestedName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!snap?.me || snap.me.nameConfirmed) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Escreva o seu nome.");
    setBusy(true);
    setError(null);
    try {
      await setMyName(name);
      await reload();
    } catch (er) {
      setError(er instanceof Error ? er.message : "Não deu para salvar agora.");
      setBusy(false);
    }
  }

  return (
    <form className="page-note name-ask" onSubmit={save}>
      <label htmlFor="my-name" className="name-ask__title">{title}</label>
      {note ? <p style={{ margin: "2px 0 0" }}>{note}</p> : null}
      <div className="name-ask__row">
        <input id="my-name" className="input" value={name} maxLength={40} autoComplete="given-name" placeholder="Ex.: Ana" onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
      </div>
      {error ? <p className="field-error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
    </form>
  );
}

/** Ajustes → Conta: mudar o nome que a família vê. */
export function MyNameField() {
  const { snap, reload } = useStore();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!snap?.me) return null;
  const value = name ?? snap.me.name;
  const dirty = value.trim() !== snap.me.name || !snap.me.nameConfirmed;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await setMyName(value);
      await reload();
      setName(null);
      setMsg("Nome salvo.");
    } catch (er) {
      setMsg(er instanceof Error ? er.message : "Não deu para salvar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="field" onSubmit={save} style={{ margin: 0 }}>
      <label htmlFor="conta-nome">Seu nome <span className="muted">(a família vê nas fotos e cartinhas)</span></label>
      <div className="name-ask__row">
        <input id="conta-nome" className="input" value={value} maxLength={40} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn--secondary" disabled={busy || !dirty || !value.trim()}>Salvar</button>
      </div>
      {msg ? <p className="small" role="status" style={{ margin: 0 }}>{msg}</p> : null}
    </form>
  );
}
