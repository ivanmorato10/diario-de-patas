"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ACHADINHOS } from "@/config/achadinhos";

/** Cartão discreto na tela Hoje que leva à lista completa (sem pop-up). */
export function AchadinhosCard() {
  const t = useTranslations("finds");
  if (!ACHADINHOS.length) return null;
  return (
    <Link href="/achadinhos" className="achados-card">
      <span className="achados-card__icon" aria-hidden="true">🛍️</span>
      <span className="achados-card__text">
        <strong>{t("title")}</strong>
        <span>{t("cardSub", { count: ACHADINHOS.length })}</span>
      </span>
      <span className="achados-card__go" aria-hidden="true">›</span>
    </Link>
  );
}
