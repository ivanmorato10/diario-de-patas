"use client";

import Link from "next/link";
import { useState } from "react";
import { AbuSays, Wordmark } from "@/components/brand";
import { IconAlbum, IconCamera, IconStar } from "@/components/icons";
import { DemoBanner } from "@/components/shell";

export default function BemVindo() {
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const steps = [
    { Icon: IconCamera, title: "Registre momentos", text: "Uma soneca, um passeio, uma cara engraçada." },
    { Icon: IconStar, title: "Complete missões", text: "Pequenos convites, sem pressa e sem sequência obrigatória." },
    { Icon: IconAlbum, title: "Monte seu álbum", text: "As lembranças viram páginas que você pode rever." },
  ];
  return (
    <div className="shell">
      <DemoBanner />
      <main className="main main--bare" style={{ gap: 28, paddingTop: 32 }}>
        <Wordmark size={40} />
        <div className="stack">
          <h1>Pequenas aventuras. Memórias para sempre.</h1>
          <p className="muted">Um diário com missões, fotos e lembranças do seu melhor amigo.</p>
        </div>
        <AbuSays>Oi, eu sou o Abu! Vamos guardar as suas aventuras?</AbuSays>
        <ol className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {steps.map(({ Icon, title, text }, i) => (
            <li key={title} className="card row" style={{ padding: 16 }}>
              <span className="mission-stamp" aria-hidden="true"><Icon /></span>
              <span className="stack" style={{ gap: 2 }}>
                <span className="caption">Passo {i + 1}</span>
                <strong>{title}</strong>
                <span className="small muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="stack">
          <Link href="/comecar" className="btn btn--primary btn--block">Criar meu diário</Link>
          <button type="button" className="btn btn--secondary btn--block" onClick={() => setShowAccountInfo((v) => !v)} aria-expanded={showAccountInfo} aria-controls="conta-info">
            Já tenho conta
          </button>
          {showAccountInfo ? (
            <p id="conta-info" className="notice notice--info" role="status">
              Contas ainda não estão ativas nesta versão de teste. Por enquanto o diário fica salvo só neste aparelho.
            </p>
          ) : null}
        </div>
        <p className="caption" style={{ textAlign: "center" }}>Inspirado no Abu</p>
      </main>
    </div>
  );
}
