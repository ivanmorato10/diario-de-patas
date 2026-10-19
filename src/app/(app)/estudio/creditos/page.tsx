"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/i18n/use-format";
import { useErrorText } from "@/i18n/use-error";
import { DomainError } from "@/data/demo-repository";
import { createPurchase, creditShop, fakePayPurchase, purchaseStatus, studioState, type CreditPurchase, type CreditShop } from "@/data/studio-client";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { IconInfo, Paw } from "@/components/icons";
import { PawBurst } from "@/components/celebrate";


function Countdown({ until }: { until: string | null }) {
  const [left, setLeft] = useState(() => (until ? Date.parse(until) - Date.now() : 0));
  const t = useTranslations("credits");
  useEffect(() => {
    const t = setInterval(() => setLeft(until ? Date.parse(until) - Date.now() : 0), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until || left <= 0) return null;
  const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
  return <span className="pix-timer">{t("expiresIn", { time: `${m}:${String(s).padStart(2, "0")}` })}</span>;
}

function PixPanel({ purchase, test, onPaid, onRestart }: { purchase: CreditPurchase; test: boolean; onPaid: (p: CreditPurchase) => void; onRestart: () => void }) {
  const [copied, setCopied] = useState(false);
  const [p, setP] = useState(purchase);
  const t = useTranslations("credits");
  const f = useFormat();
  const money = (cents: number) => f.money(cents, p.currency || "BRL");
  useEffect(() => {
    if (p.status !== "pending") return;
    const t = setInterval(async () => {
      try {
        const n = await purchaseStatus(p.id);
        setP(n);
        if (n.status === "approved") onPaid(n);
      } catch { /* tenta de novo */ }
    }, 4000);
    return () => clearInterval(t);
  }, [p.id, p.status, onPaid]);

  async function copy() {
    if (!p.pixQr) return;
    try {
      await navigator.clipboard.writeText(p.pixQr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      (document.getElementById("pix-code") as HTMLTextAreaElement | null)?.select();
    }
  }

  if (p.status === "expired" || p.status === "cancelled" || p.status === "rejected") {
    return (
      <section className="pix-card stack" role="alert">
        <h2>{p.status === "expired" ? t("pixExpired") : t("notCompleted")}</h2>
        <p className="muted">{t("notCharged")}</p>
        <button type="button" className="btn btn--primary btn--block" onClick={onRestart}>{t("newPix")}</button>
      </section>
    );
  }

  return (
    <section className="pix-card" aria-live="polite">
      <div className="pix-card__head">
        <span className="pix-card__amount">{money(p.amountCents)}</span>
        <span className="pix-card__credits"><Paw size={16} /> {t("creditsN", { count: p.credits })}</span>
      </div>
      {p.pixQrBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pix-qr" src={`data:image/png;base64,${p.pixQrBase64}`} alt={t("qrAlt")} width={220} height={220} />
      ) : (
        <div className="pix-qr pix-qr--placeholder" aria-hidden="true"><span>{test ? t("qrTest") : t("qr")}</span></div>
      )}
      <ol className="pix-steps">
        <li>{t.rich("step1", { strong: (c) => <strong>{c}</strong> })}</li>
        <li>{t.rich("step2", { amount: money(p.amountCents), strong: (c) => <strong>{c}</strong> })}</li>
        <li>{t("step3")}</li>
      </ol>
      {p.pixQr ? (
        <div className="field">
          <label htmlFor="pix-code">{t("copyPaste")}</label>
          <textarea id="pix-code" className="textarea pix-code" readOnly value={p.pixQr} rows={3} onFocus={(e) => e.target.select()} />
          <button type="button" className="btn btn--secondary btn--block" onClick={copy}>{copied ? t("copied") : t("copyCode")}</button>
        </div>
      ) : null}
      <div className="pix-wait"><span className="sp-spinner" aria-hidden="true" /> {t("waiting")} <Countdown until={p.expiresAt} /></div>
      {test ? (
        <button type="button" className="btn btn--ghost btn--block" onClick={async () => { await fakePayPurchase(p.id); const n = await purchaseStatus(p.id); setP(n); if (n.status === "approved") onPaid(n); }}>
          {t("simulate")}
        </button>
      ) : null}
    </section>
  );
}

export default function Creditos() {
  const { ready, snap, unavailable } = useRequireDiary();
  const [shop, setShop] = useState<CreditShop | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [pick, setPick] = useState("p5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<CreditPurchase | null>(null);
  const [paid, setPaid] = useState<CreditPurchase | null>(null);
  const idem = useRef("");
  const t = useTranslations("credits");
  const f = useFormat();
  const errText = useErrorText();
  const money = (cents: number) => f.money(cents, shop?.currency ?? "BRL");

  const load = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([creditShop(), studioState()]);
      setShop(s);
      setBalance(st.balance);
      const open = s.purchases.find((x) => x.status === "pending" && x.expiresAt && Date.parse(x.expiresAt) > Date.now());
      if (open) setCurrent((c) => c ?? open);
    } catch (e) {
      setError(errText(e instanceof DomainError ? e : null, "credits.loadFailed"));
    }
  }, [errText]);
  useEffect(() => {
    idem.current = crypto.randomUUID();
    void load();
  }, [load]);

  const onPaid = useCallback((p: CreditPurchase) => {
    setPaid(p);
    setCurrent(null);
    idem.current = crypto.randomUUID();
    void load();
  }, [load]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      setCurrent(await createPurchase(pick, idem.current));
    } catch (e) {
      setError(errText(e instanceof DomainError ? e : null, "credits.pixFailed"));
    } finally {
      setBusy(false);
    }
  }

  const pkg = shop?.packages.find((p) => p.id === pick);

  return (
    <>
      <TopBar title={t("title")} back="/estudio" emoji="🪙" />
      <main className="main">
        <div className="stack">
          <h1 className="studio-title">{t("heading", { dog: snap.dog.name })}</h1>
          <p className="page-note">{t("note", { dog: snap.dog.name })}</p>
          {balance !== null ? <p className="shop-balance"><Paw size={16} /> {t.rich("balance", { count: balance, strong: (c) => <strong>{c}</strong> })}</p> : null}
        </div>

        {paid ? (
          <section className="pix-card pix-card--done" role="status">
            <PawBurst />
            <h2>+{t("creditsN", { count: paid.credits })}!</h2>
            <p>{t("paid")}</p>
            <Link href="/estudio" className="btn btn--primary btn--block">{t("createArt")}</Link>
            <button type="button" className="btn btn--ghost" onClick={() => setPaid(null)}>{t("buyMore")}</button>
          </section>
        ) : current ? (
          <PixPanel purchase={current} test={!!shop?.test} onPaid={onPaid} onRestart={() => { setCurrent(null); idem.current = crypto.randomUUID(); }} />
        ) : shop && !shop.enabled ? (
          <div className="notice notice--info"><IconInfo /><span>{t.rich(shop.market === "US" ? "soonUsd" : "soon", { strong: (c) => <strong>{c}</strong> })}</span></div>
        ) : shop ? (
          <section className="stack">
            {shop.test ? <div className="notice notice--warn small"><IconInfo /><span>{t.rich("testMode", { strong: (c) => <strong>{c}</strong> })}</span></div> : null}
            {/* Preço na moeda real da cobrança: em inglês, deixa claro que é em reais (Pix, Brasil), sem conversão. */}
            {f.locale !== "pt-BR" && shop.currency !== "USD" ? <div className="notice notice--info small"><IconInfo /><span>{t("currencyNote", { currency: shop.currency })}</span></div> : null}
            <div className="shop-packs" role="radiogroup" aria-label={t("packsLabel")}>
              {shop.packages.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={pick === p.id} aria-label={t("packLabel", { count: p.credits, price: money(p.priceCents) })} className={`shop-pack${pick === p.id ? " is-selected" : ""}`} onClick={() => setPick(p.id)}>
                  {p.badge ? <span className="shop-pack__badge">{t(`badges.${p.badge}`)}</span> : null}
                  <span className="shop-pack__credits">{p.credits}</span>
                  <span className="shop-pack__unit">{t("unit", { count: p.credits })}</span>
                  <span className="shop-pack__price">{money(p.priceCents)}</span>
                  <span className="shop-pack__per">{t("perArt", { price: money(Math.round(p.priceCents / p.credits)) })}</span>
                </button>
              ))}
            </div>
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <button type="button" className="btn btn--primary btn--block" onClick={buy} disabled={busy || !pkg}>
              {busy ? t("generating") : pkg ? t("pay", { price: money(pkg.priceCents) }) : t("pickPack")}
            </button>
            <p className="caption" style={{ textAlign: "center" }}>{t("oneTime")}</p>
          </section>
        ) : error ? <p className="field-error" role="alert">{error}</p> : <PageLoading />}

        {shop && shop.purchases.length ? (
          <section className="stack" aria-labelledby="hist">
            <h2 id="hist" style={{ fontSize: "1.0625rem" }}>{t("history")}</h2>
            <ul className="shop-history">
              {shop.purchases.map((p) => (
                <li key={p.id}>
                  <span>{t("creditsN", { count: p.credits })} · {f.money(p.amountCents, p.currency || "BRL")}{p.test ? ` ${t("test")}` : ""}</span>
                  <span className={`chip ${p.status === "approved" ? "" : "chip--outline"}`}>{t(`status.${p.status}`)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}
