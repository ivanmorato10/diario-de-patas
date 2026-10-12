"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AbuCard, AbuFace, AbuMascot } from "@/components/brand";
import { IconStar, Paw } from "@/components/icons";
import { DemoBanner } from "@/components/shell";

/**
 * Introdução emocional (pedido do proprietário): o Abu se apresenta e conta por que o app existe.
 * Nada aqui inventa fatos sobre o Abu — só o propósito do diário.
 */
const STEPS = [
  {
    title: "Oi, eu sou o Abu!",
    text: "Minha vida tem passeios, sonecas e umas travessuras que merecem ser lembradas.\nAposto que a do seu cachorro também.\nVamos guardar essas histórias juntos?",
  },
  {
    title: "A vida com a gente é feita de momentos pequenos.",
    text: "Uma soneca no sol, o primeiro passeio do dia, aquela pose caprichada para a foto. Eles passam rápido — e acabam perdidos no meio de milhares de fotos.",
  },
  {
    title: "Este app foi criado para guardar esses momentos.",
    text: "Aqui, cada foto vira uma página. Cada pequena aventura vira uma figurinha no álbum. E, com o tempo, vocês ganham a história inteira de vocês dois.",
  },
  {
    title: "Os anos passam depressa para nós.",
    text: "Um dia você vai querer rever cada detalhe: o jeito de dormir, a bagunça, o olhar de quem esperou você chegar. Tudo vai estar guardado aqui.",
  },
  {
    title: "Sempre juntos.",
    text: "Agora é a vez do seu melhor amigo. Vamos começar a história de vocês?",
  },
];

function StepVisual({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className="intro-visual">
        <div className="intro-halo" aria-hidden="true" />
        <div className="anim-bounce-in"><div className="anim-hello"><div className="anim-float"><AbuMascot width={190} alt="Abu, o cachorro que inspirou o app, segurando um livro" /></div></div></div>
      </div>
    );
  }
  if (step === 1) {
    const moments = [
      { src: "/moments/soneca.webp", label: "Soneca no sol", focus: "45% 62%" },
      { src: "/moments/passeio.webp", label: "Passeio", focus: "62% 72%" },
      { src: "/moments/pose.webp", label: "Fazendo pose", focus: "50% 22%" },
    ];
    return (
      <div className="intro-visual intro-moments" aria-hidden="true">
        {moments.map(({ src, label, focus }, i) => (
          <div key={label} className="polaroid intro-mini" style={{ animationDelay: `${250 + i * 800}ms`, ["--tilt" as string]: `${[-6, 3, -2][i]}deg` }}>
            <img src={src} alt="" className="intro-mini__photo" style={{ objectPosition: focus }} />
            <p className="polaroid__note" style={{ fontSize: "0.95rem", textAlign: "center" }}>{label}</p>
          </div>
        ))}
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="intro-visual" aria-hidden="true">
        <div className="intro-album anim-pop">
          <div className="intro-album__title">Nosso álbum</div>
          <div className="intro-album__grid">
            {[0, 1, 2, 3, 4, 5].map((i) =>
              i < 4 ? (
                <span key={i} className="mission-stamp anim-stamp" style={{ animationDelay: `${300 + i * 220}ms` }}><IconStar /></span>
              ) : (
                <span key={i} className="mission-stamp mission-stamp--locked" />
              ),
            )}
          </div>
        </div>
      </div>
    );
  }
  if (step === 3) {
    return (
      <div className="intro-visual" aria-hidden="true">
        <div className="intro-halo intro-halo--warm" />
        <div className="anim-pop"><div className="anim-float"><AbuMascot width={190} /></div></div>
        <div className="paw-trail" style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
          {[0, 1, 2, 3, 4].map((i) => <span key={i}><Paw size={22} /></span>)}
        </div>
      </div>
    );
  }
  return (
    <div className="intro-visual">
      <div className="anim-pop"><div className="anim-float"><AbuCard width={220} /></div></div>
    </div>
  );
}

export default function BemVindo() {
  const [step, setStep] = useState(0);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const last = step === STEPS.length - 1;

  useEffect(() => {
    if (step > 0) titleRef.current?.focus();
  }, [step]);

  return (
    <div className="shell intro">
      <DemoBanner />
      <main className="main main--bare intro__main">
        <div className="row-between">
          <span className="row" style={{ gap: 8 }}><AbuFace size={34} className="brand-lockup__face" /><span className="brand-lockup__name" style={{ fontSize: "1.15rem" }}>Diário de Patas</span></span>
          {!last ? <button type="button" className="btn btn--ghost btn--small" onClick={() => setStep(STEPS.length - 1)}>Pular</button> : null}
        </div>

        <section key={step} className="intro__slide" aria-live="polite">
          <StepVisual step={step} />
          <div className={`stack${step === 0 ? " intro-diary anim-rise" : ""}`} style={{ textAlign: "center", alignItems: "center" }}>
            <h1 ref={titleRef} tabIndex={-1} className="anim-rise" style={{ maxWidth: 420 }}>{STEPS[step].title}{step === 0 ? <Paw size={30} className="intro-diary__paw" /> : null}</h1>
            <p className="anim-rise-2 intro__text">{STEPS[step].text}</p>
          </div>
        </section>

        <div className="stack intro__actions">
          <div className="intro-dots" role="img" aria-label={`Passo ${step + 1} de ${STEPS.length}`}>
            {STEPS.map((_, i) => <span key={i} className={i === step ? "is-active" : i < step ? "is-done" : ""} />)}
          </div>
          {last ? (
            <>
              <Link href="/comecar" className="btn btn--primary btn--block anim-rise-3">Criar o diário do meu cachorro</Link>
              <button type="button" className="btn btn--secondary btn--block" onClick={() => setShowAccountInfo((v) => !v)} aria-expanded={showAccountInfo} aria-controls="conta-info">
                Já tenho conta
              </button>
              {showAccountInfo ? (
                <p id="conta-info" className="notice notice--info" role="status">
                  Contas ainda não estão ativas nesta versão de teste. Por enquanto o diário fica salvo só neste aparelho.
                </p>
              ) : null}
            </>
          ) : (
            <div className="row" style={{ gap: 10 }}>
              {step > 0 ? <button type="button" className="btn btn--secondary" onClick={() => setStep((s) => s - 1)} aria-label="Voltar">Voltar</button> : null}
              <button type="button" className="btn btn--primary" style={{ flex: 1 }} onClick={() => setStep((s) => s + 1)}>
                {step === 0 ? "Vamos nessa, Abu!" : "Continuar"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

