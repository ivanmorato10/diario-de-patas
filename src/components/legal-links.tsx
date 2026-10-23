"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

/** Links para Termos, Privacidade e Reembolso (tela de entrada, Sobre, compra de créditos). */
export function LegalLinks({ only }: { only?: ("terms" | "privacy" | "refund")[] }) {
  const t = useTranslations("legal");
  const all = [["terms", "/termos"], ["privacy", "/privacidade"], ["refund", "/reembolso"]] as const;
  return (
    <p className="legal-links" aria-label={t("label")}>
      {all.filter(([k]) => !only || only.includes(k)).map(([k, href]) => <Link key={k} href={href}>{t(k)}</Link>)}
    </p>
  );
}
