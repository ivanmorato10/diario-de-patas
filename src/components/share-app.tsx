"use client";

import { useState } from "react";
import { rpc } from "@/data/real-repository";
import { useStore } from "@/data/store";
import { Sheet } from "./entry-actions";
import { IconChevron } from "./icons";
import { ShareActions } from "./share-actions";

interface ReferralInfo { code: string; joined: number; confirmed: number; xpEarned: number; xpPerFriend: number; monthlyCap: number }

/** Indicar o app: link próprio; quando o amigo cria o diário e guarda a primeira foto, o cachorro ganha patinhas. */
export function ShareApp() {
  const { snap } = useStore();
  const name = snap?.dog?.name ?? "meu cachorro";
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function show() {
    setOpen(true);
    setError(null);
    try { setInfo(await rpc<ReferralInfo>("referralInfo")); } catch { setError("Não deu para preparar o seu link agora. Tente de novo."); }
  }

  const link = info ? `${window.location.origin}/?ref=${info.code}` : "";
  const text = `Oi! Estou guardando os momentos de ${name} no Diário de Patas 🐾 É grátis e privado. Cria o diário do seu cachorro também: ${link}`;

  return (
    <>
      <button type="button" className="card row-between share-app" style={{ padding: 16 }} onClick={show}>
        <span>💌 Indicar o Diário de Patas</span><IconChevron />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="share-app-title">
        <h2 id="share-app-title">Indicar o Diário de Patas</h2>
        <p className="page-note">Conhece alguém que ama um cachorro? Mande o seu link. Quando a pessoa criar o diário e guardar a primeira foto, {name} ganha {info?.xpPerFriend ?? 20} patinhas!</p>
        {info ? (
          <div className="stack" style={{ gap: 10 }}>
            <input className="input" readOnly value={link} aria-label="Seu link de indicação" onFocus={(e) => e.currentTarget.select()} />
            <ShareActions text={text} onCopyError={() => setError("Não deu para copiar automaticamente: toque e segure no link para copiar.")} />
            <p className="caption" style={{ margin: 0 }}>
              {info.joined === 0 ? "Ninguém entrou pelo seu link ainda." : `${info.joined} ${info.joined === 1 ? "pessoa entrou" : "pessoas entraram"} pelo seu link · ${info.xpEarned} patinhas ganhas.`}
              {" "}Vale para até {info.monthlyCap} amigos por mês.
            </p>
          </div>
        ) : !error ? <p className="caption">Preparando o seu link…</p> : null}
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={() => setOpen(false)}>Fechar</button>
      </Sheet>
    </>
  );
}
