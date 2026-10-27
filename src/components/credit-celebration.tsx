"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { XP_MONTH_GOAL } from "@/config/credits";
import { AbuMascot } from "@/components/brand";
import { rpc } from "@/data/real-repository";

/**
 * Comemoração vista (uma vez por cachorro e mês): marcada neste aparelho e na conta, para não voltar a cada
 * login ou aparelho novo (app do iPhone, outro navegador).
 */
const seenKey = (dogId: string, month: string) => `ddp-celebrated-${dogId}-${month}`;
export function celebrationSeen(dogId: string, month: string, celebrated?: string[]) {
  if (celebrated?.includes(`${dogId}:${month}`)) return true;
  try { return localStorage.getItem(seenKey(dogId, month)) === "1"; } catch { return true; } // sem armazenamento: não insiste
}
export function markCelebrationSeen(dogId: string, month: string, account = false) {
  try { localStorage.setItem(seenKey(dogId, month), "1"); } catch { /* ok */ }
  if (account) void rpc("markCelebrated", { dogId, month }).catch(() => undefined); // falhou: o aparelho já lembra
}

/**
 * O saldo do Estúdio guardado no aparelho (mostrado antes de o servidor responder) já sobe junto: ao abrir o
 * Estúdio, o crédito novo aparece de uma vez, sem precisar sair e entrar.
 */
export function bumpCachedBalance(dogId: string, n: number) {
  try {
    const key = `ddp-studio-${dogId}`;
    const saved = localStorage.getItem(key);
    if (!saved) return;
    const st = JSON.parse(saved) as { balance?: number };
    localStorage.setItem(key, JSON.stringify({ ...st, balance: (st.balance ?? 0) + n }));
  } catch { /* ok */ }
}

const BURSTS = [
  { x: 22, y: 26, delay: 0, color: "var(--accent)" },
  { x: 78, y: 20, delay: 350, color: "var(--brand-teal)" },
  { x: 50, y: 10, delay: 700, color: "#f2b632" },
  { x: 30, y: 58, delay: 1050, color: "var(--reward)" },
  { x: 72, y: 54, delay: 1400, color: "var(--accent)" },
];
const SPARKS = 18;
const CONFETTI = ["var(--accent)", "var(--brand-teal)", "#f2b632", "var(--reward)", "#e86a92", "var(--brand-soft)"];

/**
 * 200 patinhas no mês = 1 crédito: fogos, o Abu comemorando e o atalho para o Estúdio. Quem prefere menos
 * movimento vê só a janela (sem fogos). Fecha no "Depois", no Esc ou tocando fora.
 */
export function CreditCelebration({ open, dogName, onClose }: { open: boolean; dogName: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useTranslations("celebrate");
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="celebrate" aria-labelledby="celebrate-title" onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="celebrate__fireworks" aria-hidden="true">
        {BURSTS.map((b, i) => (
          <span key={i} className="celebrate__burst" style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: `${b.delay}ms`, color: b.color } as React.CSSProperties}>
            {Array.from({ length: SPARKS }, (_, k) => (
              <i key={k} style={{ "--a": `${(360 / SPARKS) * k}deg`, animationDelay: `${b.delay}ms` } as React.CSSProperties} />
            ))}
          </span>
        ))}
        {Array.from({ length: 28 }, (_, k) => (
          <b key={k} className="celebrate__confetti" style={{ left: `${(k * 37) % 100}%`, background: CONFETTI[k % CONFETTI.length], animationDelay: `${(k * 113) % 1400}ms`, "--r": `${(k * 47) % 360}deg`, "--x": `${((k * 29) % 60) - 30}px` } as React.CSSProperties} />
        ))}
      </div>
      <div className="celebrate__card">
        <AbuMascot width={128} className="celebrate__abu" />
        <p className="celebrate__paws">🐾 {t("paws", { goal: XP_MONTH_GOAL })} 🐾</p>
        <h2 id="celebrate-title" tabIndex={-1} autoFocus>{t("title")}</h2>
        <p>{t("text", { dog: dogName })}</p>
        <Link href="/estudio" className="btn btn--primary btn--block" onClick={onClose}>{t("create")}</Link>
        <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>{t("later")}</button>
      </div>
    </dialog>
  );
}
