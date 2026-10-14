import Link from "next/link";
import { ACHADINHOS } from "@/config/achadinhos";

/** Cartão discreto na tela Hoje que leva à lista completa (sem pop-up). */
export function AchadinhosCard() {
  if (!ACHADINHOS.length) return null;
  return (
    <Link href="/achadinhos" className="achados-card">
      <span className="achados-card__icon" aria-hidden="true">🛍️</span>
      <span className="achados-card__text">
        <strong>Achadinhos do Abu</strong>
        <span>O que eu uso e aprovo · {ACHADINHOS.length} {ACHADINHOS.length === 1 ? "item" : "itens"}</span>
      </span>
      <span className="achados-card__go" aria-hidden="true">›</span>
    </Link>
  );
}
