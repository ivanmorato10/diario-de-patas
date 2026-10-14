"use client";

import { useState } from "react";
import { ACHADINHOS, ACHADINHO_CATEGORIES, AFFILIATE_DISCLOSURE, type AchadinhoCategory } from "@/config/achadinhos";
import { TopBar } from "@/components/shell";
import { AbuMascot } from "@/components/brand";

/** Lista completa dos achadinhos, com filtro por categoria. Nada aparece por cima de outras telas. */
export default function Achadinhos() {
  const [cat, setCat] = useState<AchadinhoCategory | "todos">("todos");
  const used = ACHADINHO_CATEGORIES.filter((c) => ACHADINHOS.some((a) => a.category === c.id));
  const list = ACHADINHOS.filter((a) => cat === "todos" || a.category === cat);
  return (
    <>
      <TopBar title="Achadinhos do Abu" back="/hoje" />
      <main className="main">
        <section className="achados-hero">
          <div className="achados-hero__abu" aria-hidden="true"><AbuMascot width={96} /></div>
          <div>
            <h1 className="studio-title" style={{ fontSize: "2rem" }}>Achadinhos do Abu</h1>
            <p className="muted">As coisas que eu uso, roo e aprovo. Escolhidas com carinho, sem patrocínio de marca.</p>
          </div>
        </section>

        <div className="achados-filter" role="tablist" aria-label="Categorias">
          {[{ id: "todos" as const, label: "Todos", emoji: "🐾" }, ...used].map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} className={`achados-chip${cat === c.id ? " is-active" : ""}`} onClick={() => setCat(c.id)}>
              <span aria-hidden="true">{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>

        <ul className="achados-grid">
          {list.map((a) => {
            const c = ACHADINHO_CATEGORIES.find((x) => x.id === a.category)!;
            return (
              <li key={a.id} className="achado">
                <div className="achado__art" style={{ background: c.bg }} aria-hidden="true">
                  {a.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.photo} alt="" />
                  ) : (
                    <span className="achado__emoji">{c.emoji}</span>
                  )}
                  <span className="achado__tag">{c.label}</span>
                </div>
                <div className="achado__body">
                  <h2>{a.name}</h2>
                  <p className="achado__abu">“{a.abuSays}”</p>
                  <a className="achado__btn" href={a.url} target="_blank" rel="sponsored noopener noreferrer">Ver na {a.store}</a>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="caption achados-disclosure">{AFFILIATE_DISCLOSURE} Preços e disponibilidade são definidos pela loja. Recomendações não substituem a orientação do veterinário.</p>
      </main>
    </>
  );
}
