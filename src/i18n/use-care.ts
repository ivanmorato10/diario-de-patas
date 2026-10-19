"use client";

/** Textos de Cuidados montados a partir de dados (status, distância até a data, itens de "Próximos cuidados"). */
import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { daysUntil, type CareItem } from "@/domain/health";
import { useFormat } from "./use-format";

export function useCareText() {
  const t = useTranslations("care");
  const tt = useTranslations("careItems");
  const f = useFormat();
  /** "em 10 dias", "amanhã", "há 2 dias" — sempre junto do rótulo (nunca só cor). */
  const dueText = useCallback((date: string, today: string) => {
    const d = daysUntil(date, today);
    return d >= 0 ? t("dueIn", { days: d }) : t("dueAgo", { days: -d });
  }, [t]);
  const itemTitle = useCallback((i: CareItem, today: string) => {
    if (i.kind === "vaccine") return `${t(`vaccineKinds.${i.vaccineKind ?? "other"}`)}: ${i.name}`;
    if (i.kind === "medication") return tt("medication", { name: i.name });
    if (i.kind === "document") return tt("document", { name: i.name });
    if (i.visit === "next") return tt("nextVisit");
    const time = i.time ? f.clock(i.time) : "";
    const base = i.date === today ? (time ? tt("visitTodayAt", { time }) : tt("visitToday")) : time ? tt("visitAt", { time }) : tt("visit");
    return i.name ? `${base}: ${i.name}` : base;
  }, [t, tt, f]);
  return { dueText, itemTitle };
}
