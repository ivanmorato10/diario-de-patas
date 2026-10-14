"use client";

import { useEffect, useState } from "react";
import { REAL_MODE } from "@/config/mode";
import { rpc } from "@/data/real-repository";
import { ACHADINHOS, ACHADINHO_CATEGORIES, AFFILIATE_DISCLOSURE, amazonUrl, type Achadinho, type AchadinhoCategory } from "@/config/achadinhos";
import { isStandalone } from "@/components/install-app";
import { TopBar } from "@/components/shell";
import { AbuMascot } from "@/components/brand";

/** Foto própria do produto (public/achadinhos/…); sem ela, a ilustração da categoria. */
type Info = Record<string, { title: string | null; image: string | null }>;

function ProductArt({ a, emoji, bg, label, image }: { a: Achadinho; emoji: string; bg: string; label: string; image?: string | null }) {
  const [failed, setFailed] = useState(false);
  const src = a.photo ?? image ?? null;
  const photo = !!src && !failed;
  return (
    <div className={`achado__art${photo ? " achado__art--own" : ""}`} style={{ background: photo && !a.photo ? "#fff" : bg }} aria-hidden="true">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src!} alt="" loading="lazy" onError={() => setFailed(true)} style={a.photo ? undefined : { objectFit: "contain", padding: 10 }} />
      ) : (
        <span className="achado__emoji">{emoji}</span>
      )}
      <span className="achado__tag">{label}</span>
    </div>
  );
}

/** Lista completa dos achadinhos, com filtro por categoria. Nada aparece por cima de outras telas. */
export default function Achadinhos() {
  const [cat, setCat] = useState<AchadinhoCategory | "todos">("todos");
  const [info, setInfo] = useState<Info>({});
  // Foto e título oficiais pela Creators API, quando a conta de associado estiver elegível.
  useEffect(() => {
    if (!REAL_MODE) return;
    rpc<{ status: string; items: Info }>("achadinhosInfo").then((r) => setInfo(r.items)).catch(() => undefined);
  }, []);
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
                <ProductArt a={a} emoji={c.emoji} bg={c.bg} label={c.label} image={info[a.asin]?.image} />
                <div className="achado__body">
                  <h2>{a.name}</h2>
                  <p className="achado__abu">“{a.abuSays}”</p>
                  <a className="achado__btn" href={amazonUrl(a)} target="_blank" rel="sponsored noopener noreferrer">Ver na {a.store}</a>
                </div>
              </li>
            );
          })}
        </ul>

        {typeof window !== "undefined" && isStandalone() ? <p className="caption achados-disclosure">O produto abre na Amazon. Para voltar, toque em “OK” ou “Concluído” no canto da tela, ou abra o Diário de Patas de novo.</p> : null}
        <p className="caption achados-disclosure">{AFFILIATE_DISCLOSURE} Preços e disponibilidade são definidos pela loja. Recomendações não substituem a orientação do veterinário.</p>
      </main>
    </>
  );
}
