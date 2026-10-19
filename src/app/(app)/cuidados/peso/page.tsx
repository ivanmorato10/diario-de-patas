"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/i18n/use-format";
import { useSetPreferences } from "@/components/locale-sync";

import { useStore } from "@/data/store";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { WeightChart } from "@/components/health-ui";
import { DeleteSheet, Field, RowActions, useCareMutation } from "@/components/care-forms";
import type { WeightRecord } from "@/domain/health";

export default function Peso() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo } = useStore();
  const { busy, error, setError, run } = useCareMutation();
  const [date, setDate] = useState("");
  const [kg, setKg] = useState("");
  const [toDelete, setToDelete] = useState<WeightRecord | null>(null);
  const t = useTranslations("weightPage");
  const f = useFormat();
  const setPrefs = useSetPreferences();

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !repo) return <main className="main"><PageLoading /></main>;
  const weights = snap.health.weights;
  const unit = f.weightUnit;
  const example = f.number(unit === "lb" ? 18.5 : 8.4);

  /** A pessoa digita na unidade dela; o servidor recebe sempre kg (o registro real não muda ao trocar a unidade). */
  async function add() {
    const value = Number(kg.trim().replace(/\s/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, ""));
    if (!kg.trim() || Number.isNaN(value)) return setError(`weightPage.invalid?unit=${unit}&example=${encodeURIComponent(example)}`);
    if (await run(() => repo!.addWeight({ date: date || snap!.today, kg: f.toKg(value) }))) setKg("");
  }

  return (
    <>
      <TopBar title={t("title")} back="/cuidados" emoji="⚖️" />
      <main className="main">
        <section className="card stack" aria-labelledby="peso-hist">
          <h2 id="peso-hist" style={{ fontSize: "1.0625rem" }}>{t("history")}</h2>
          {weights.length >= 2 ? <WeightChart weights={weights} /> : <p className="small muted">{weights.length === 1 ? t("oneMore") : t("none")}</p>}
          {weights.length ? (
            <table className="data-table">
              <caption className="sr-only">{t("tableCaption")}</caption>
              <thead><tr><th scope="col">{t("date")}</th><th scope="col">{t("weight")}</th><th scope="col"><span className="sr-only">{t("actions")}</span></th></tr></thead>
              <tbody>
                {[...weights].reverse().map((w) => (
                  <tr key={w.id}>
                    <td>{f.date(w.date)}</td>
                    <td>{f.weight(w.kg, 2)}</td>
                    <td style={{ textAlign: "right" }}><RowActions label={t("rowLabel", { date: f.date(w.date) })} onDelete={() => setToDelete(w)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); add(); }} aria-labelledby="peso-novo" noValidate>
          <h2 id="peso-novo" style={{ fontSize: "1.0625rem" }}>{t("new")}</h2>
          <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 140px" }}><Field id="kg" label={t("weightIn", { unit })} value={kg} onChange={setKg} inputMode="decimal" placeholder={example} /></div>
            <div style={{ flex: "1 1 140px" }}><Field id="wdate" label={t("date")} type="date" value={date || snap.today} max={snap.today} onChange={setDate} /></div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }} role="radiogroup" aria-label={t("unitLabel")}>
            <span className="caption">{t("unitLabel")}</span>
            {(["kg", "lb"] as const).map((u) => (
              <button key={u} type="button" role="radio" aria-checked={unit === u} className={`filter-chip${unit === u ? " is-active" : ""}`} onClick={() => void setPrefs({ weightUnit: u })}>{u}</button>
            ))}
          </div>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{t("add")}</button>
        </form>
      </main>
      <DeleteSheet open={!!toDelete} onClose={() => setToDelete(null)} title={t("deleteTitle")} text={toDelete ? t("deleteText", { weight: f.weight(toDelete.kg, 2), date: f.date(toDelete.date) }) : ""} busy={busy}
        onConfirm={async () => { if (toDelete && (await run(() => repo!.deleteHealthRecord("weights", toDelete.id)))) setToDelete(null); }} />
    </>
  );
}
