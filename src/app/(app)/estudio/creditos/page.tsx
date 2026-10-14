"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { REAL_MODE } from "@/config/mode";
import { formatBRL } from "@/config/credits";
import { DomainError } from "@/data/demo-repository";
import { createPurchase, creditShop, fakePayPurchase, purchaseStatus, studioState, type CreditPurchase, type CreditShop } from "@/data/studio-client";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { IconInfo, Paw } from "@/components/icons";
import { PawBurst } from "@/components/celebrate";

const STATUS_PT: Record<CreditPurchase["status"], string> = {
  pending: "Aguardando pagamento", approved: "Pago", rejected: "Recusado", expired: "Vencido", cancelled: "Cancelado", refunded: "Estornado",
};

function Countdown({ until }: { until: string | null }) {
  const [left, setLeft] = useState(() => (until ? Date.parse(until) - Date.now() : 0));
  useEffect(() => {
    const t = setInterval(() => setLeft(until ? Date.parse(until) - Date.now() : 0), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until || left <= 0) return null;
  const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
  return <span className="pix-timer">Vence em {m}:{String(s).padStart(2, "0")}</span>;
}

function PixPanel({ purchase, test, onPaid, onRestart }: { purchase: CreditPurchase; test: boolean; onPaid: (p: CreditPurchase) => void; onRestart: () => void }) {
  const [copied, setCopied] = useState(false);
  const [p, setP] = useState(purchase);
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
        <h2>{p.status === "expired" ? "Esse Pix venceu" : "Pagamento não concluído"}</h2>
        <p className="muted">Nenhum valor foi cobrado. É só gerar um novo Pix.</p>
        <button type="button" className="btn btn--primary btn--block" onClick={onRestart}>Gerar outro Pix</button>
      </section>
    );
  }

  return (
    <section className="pix-card" aria-live="polite">
      <div className="pix-card__head">
        <span className="pix-card__amount">{formatBRL(p.amountCents)}</span>
        <span className="pix-card__credits"><Paw size={16} /> {p.credits} créditos</span>
      </div>
      {p.pixQrBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pix-qr" src={`data:image/png;base64,${p.pixQrBase64}`} alt="QR code do Pix" width={220} height={220} />
      ) : (
        <div className="pix-qr pix-qr--placeholder" aria-hidden="true"><span>{test ? "QR de teste" : "QR code"}</span></div>
      )}
      <ol className="pix-steps">
        <li>Abra o app do seu banco e escolha <strong>Pix › Ler QR code</strong> ou <strong>Pix copia e cola</strong>.</li>
        <li>Confira o valor de <strong>{formatBRL(p.amountCents)}</strong> e confirme.</li>
        <li>Os créditos entram aqui sozinhos, em segundos.</li>
      </ol>
      {p.pixQr ? (
        <div className="field">
          <label htmlFor="pix-code">Pix copia e cola</label>
          <textarea id="pix-code" className="textarea pix-code" readOnly value={p.pixQr} rows={3} onFocus={(e) => e.target.select()} />
          <button type="button" className="btn btn--secondary btn--block" onClick={copy}>{copied ? "Copiado!" : "Copiar código Pix"}</button>
        </div>
      ) : null}
      <div className="pix-wait"><span className="sp-spinner" aria-hidden="true" /> Aguardando o pagamento… <Countdown until={p.expiresAt} /></div>
      {test ? (
        <button type="button" className="btn btn--ghost btn--block" onClick={async () => { await fakePayPurchase(p.id); const n = await purchaseStatus(p.id); setP(n); if (n.status === "approved") onPaid(n); }}>
          Simular pagamento (só no teste)
        </button>
      ) : null}
    </section>
  );
}

export default function Creditos() {
  const { ready, snap, unavailable } = useRequireDiary();
  const [shop, setShop] = useState<CreditShop | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [pick, setPick] = useState("p15");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<CreditPurchase | null>(null);
  const [paid, setPaid] = useState<CreditPurchase | null>(null);
  const idem = useRef("");

  const load = useCallback(async () => {
    if (!REAL_MODE) return;
    try {
      const [s, st] = await Promise.all([creditShop(), studioState()]);
      setShop(s);
      setBalance(st.balance);
      const open = s.purchases.find((x) => x.status === "pending" && x.expiresAt && Date.parse(x.expiresAt) > Date.now());
      if (open) setCurrent((c) => c ?? open);
    } catch (e) {
      setError(e instanceof DomainError ? e.message : "Não conseguimos carregar a loja.");
    }
  }, []);
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
      setError(e instanceof DomainError ? e.message : "Não conseguimos gerar o Pix. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  const pkg = shop?.packages.find((p) => p.id === pick);

  return (
    <>
      <TopBar title="Créditos" back="/estudio" />
      <main className="main">
        <div className="stack">
          <h1 className="studio-title">Mais artes para {snap.dog.name}</h1>
          <p className="muted">Cada crédito vira uma arte (as premium usam 2). Os créditos ficam na sua conta e não vencem.</p>
          {balance !== null ? <p className="shop-balance"><Paw size={16} /> Você tem <strong>{balance}</strong> {balance === 1 ? "crédito" : "créditos"}</p> : null}
        </div>

        {!REAL_MODE ? (
          <div className="notice notice--info"><IconInfo /><span>A compra de créditos funciona com conta.</span></div>
        ) : paid ? (
          <section className="pix-card pix-card--done" role="status">
            <PawBurst />
            <h2>+{paid.credits} créditos!</h2>
            <p>Pagamento confirmado. Bora criar arte?</p>
            <Link href="/estudio" className="btn btn--primary btn--block">Criar uma arte</Link>
            <button type="button" className="btn btn--ghost" onClick={() => setPaid(null)}>Comprar mais</button>
          </section>
        ) : current ? (
          <PixPanel purchase={current} test={!!shop?.test} onPaid={onPaid} onRestart={() => { setCurrent(null); idem.current = crypto.randomUUID(); }} />
        ) : shop && !shop.enabled ? (
          <div className="notice notice--info"><IconInfo /><span><strong>Em breve:</strong> compra de créditos por Pix. Por enquanto, use seus créditos de teste.</span></div>
        ) : shop ? (
          <section className="stack">
            {shop.test ? <div className="notice notice--warn small"><IconInfo /><span><strong>Modo de teste:</strong> nenhum dinheiro é cobrado.</span></div> : null}
            <div className="shop-packs" role="radiogroup" aria-label="Pacotes de créditos">
              {shop.packages.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={pick === p.id} className={`shop-pack${pick === p.id ? " is-selected" : ""}`} onClick={() => setPick(p.id)}>
                  {p.badge ? <span className="shop-pack__badge">{p.badge}</span> : null}
                  <span className="shop-pack__credits">{p.credits}</span>
                  <span className="shop-pack__unit">créditos</span>
                  <span className="shop-pack__price">{formatBRL(p.priceCents)}</span>
                  <span className="shop-pack__per">{formatBRL(Math.round(p.priceCents / p.credits))} por arte</span>
                </button>
              ))}
            </div>
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <button type="button" className="btn btn--primary btn--block" onClick={buy} disabled={busy || !pkg}>
              {busy ? "Gerando Pix…" : pkg ? `Pagar com Pix · ${formatBRL(pkg.priceCents)}` : "Escolha um pacote"}
            </button>
            <p className="caption" style={{ textAlign: "center" }}>Pagamento único pelo Mercado Pago. Sem assinatura, sem cobrança automática.</p>
          </section>
        ) : error ? <p className="field-error" role="alert">{error}</p> : <PageLoading />}

        {shop && shop.purchases.length ? (
          <section className="stack" aria-labelledby="hist">
            <h2 id="hist" style={{ fontSize: "1.0625rem" }}>Suas compras</h2>
            <ul className="shop-history">
              {shop.purchases.map((p) => (
                <li key={p.id}>
                  <span>{p.credits} créditos · {formatBRL(p.amountCents)}{p.test ? " (teste)" : ""}</span>
                  <span className={`chip ${p.status === "approved" ? "" : "chip--outline"}`}>{STATUS_PT[p.status]}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}
