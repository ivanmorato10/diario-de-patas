"use client";

/** Preferências efetivas da pessoa (idioma, região do calendário, unidade de peso) e formatação nas telas. */
import { useMemo } from "react";
import { useLocale } from "next-intl";
import { useStore } from "@/data/store";
import { defaultRegion, defaultWeightUnit, type AppLocale, type Region, type WeightUnit } from "./locale";
import { formatCivilDate, formatClock, formatInstant, formatMoney, formatMonthKey, formatNumber, formatWeight, fromKg, toKg, type CivilStyle } from "./format";

export function usePrefs(): { locale: AppLocale; region: Region; weightUnit: WeightUnit } {
  const locale = useLocale();
  const me = useStore().snap?.me;
  return { locale, region: me?.region ?? defaultRegion(locale), weightUnit: me?.weightUnit ?? defaultWeightUnit(locale) };
}

export function useFormat() {
  const { locale, weightUnit } = usePrefs();
  const tz = useStore().snap?.profile?.timezone ?? "America/Sao_Paulo";
  return useMemo(() => ({
    locale,
    weightUnit,
    date: (d: string, style: CivilStyle = "long") => formatCivilDate(d, locale, style),
    month: (key: string) => formatMonthKey(key, locale),
    instant: (iso: string | Date, opts?: Intl.DateTimeFormatOptions) => formatInstant(iso, locale, tz, opts),
    clock: (hhmm: string) => formatClock(hhmm, locale),
    number: (n: number, opts?: Intl.NumberFormatOptions) => formatNumber(n, locale, opts),
    weight: (kg: number, digits = 1) => formatWeight(kg, weightUnit, locale, digits),
    /** Valor do peso na unidade da pessoa (sem a unidade), para campos e gráficos. */
    weightValue: (kg: number) => fromKg(kg, weightUnit),
    /** O que a pessoa digitou (na unidade dela) em kg, para o servidor. */
    toKg: (value: number) => toKg(value, weightUnit),
    money: (cents: number, currency: string) => formatMoney(cents, currency, locale),
  }), [locale, weightUnit, tz]);
}
