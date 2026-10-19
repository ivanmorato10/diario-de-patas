"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { loose } from "@/i18n/keys";
import { usePrefs } from "@/i18n/use-format";
import { rpc } from "@/data/real-repository";
import { ACHADINHO_CATEGORIES, achadinhoUrl, achadinhosFor, type Achadinho, type AchadinhoCategory } from "@/config/achadinhos";
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
  const t = useTranslations("finds");
  const tl = loose(t);
  const { region } = usePrefs();
  const ACHADINHOS = achadinhosFor(region); // só os da região do app
  // Foto e título oficiais pela Creators API, quando a conta de associado estiver elegível.
  useEffect(() => {
    rpc<{ status: string; items: Info }>("achadinhosInfo").then((r) => setInfo(r.items)).catch(() => undefined);
  }, []);
  const used = ACHADINHO_CATEGORIES.filter((c) => ACHADINHOS.some((a) => a.category === c.id));
  const list = ACHADINHOS.filter((a) => cat === "todos" || a.category === cat);
  return (
    <>
      <TopBar title={t("title")} back="/hoje" emoji="🛍️" />
      <main className="main">
        <section className="achados-hero">
          <div className="achados-hero__abu" aria-hidden="true"><AbuMascot width={96} /></div>
          <div>
            <h1 className="studio-title" style={{ fontSize: "2rem" }}>{t("title")}</h1>
            <p className="page-note">{t("intro")}</p>
          </div>
        </section>

        <div className="filter-row" role="tablist" aria-label={t("categoriesLabel")}>
          {[{ id: "todos" as const, emoji: "🐾" }, ...used].map((c) => ({ ...c, label: tl(`categories.${c.id}`) })).map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} className={`filter-chip${cat === c.id ? " is-active" : ""}`} onClick={() => setCat(c.id)}>
              <span aria-hidden="true">{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>

        {list.length === 0 ? <p className="page-note">{t("soon")}</p> : null}
        <ul className="achados-grid">
          {list.map((a) => {
            const c = ACHADINHO_CATEGORIES.find((x) => x.id === a.category)!;
            return (
              <li key={a.id} className="achado">
                <ProductArt a={a} emoji={c.emoji} bg={c.bg} label={tl(`categories.${c.id}`)} image={a.asin ? info[a.asin]?.image : undefined} />
                <div className="achado__body">
                  <h2>{tl(`items.${a.id}.name`)}</h2>
                  <p className="achado__abu">“{tl(`items.${a.id}.abuSays`)}”</p>
                  <a className="achado__btn" href={achadinhoUrl(a)} target="_blank" rel="sponsored noopener noreferrer">{t("seeAt", { store: a.store })}</a>
                </div>
              </li>
            );
          })}
        </ul>

        {list.length ? <p className="caption achados-disclosure">{region === "BR" ? t("disclosureMl") : t("disclosure")}{typeof window !== "undefined" && isStandalone() ? ` ${t("backToApp")}` : ""}</p> : null}
      </main>
    </>
  );
}
