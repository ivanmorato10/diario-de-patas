"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/i18n/use-format";
import { PrefsSaveError, usePreferenceSaver } from "@/components/locale-sync";
import { fromKg, toKg } from "@/i18n/format";
import type { WeightUnit } from "@/i18n/locale";

import { useStore } from "@/data/store";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { WeightChart } from "@/components/health-ui";
import { DeleteSheet, Field, RowActions, removeCare, upsertCare, useCareMutation } from "@/components/care-forms";
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
  const unitSaver = usePreferenceSaver();
  /** Troca de unidade em andamento: vale já no mesmo toque (o estado busy só chega na próxima renderização). */
  const switching = useRef(false);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !repo) return <main className="main"><PageLoading /></main>;
  const weights = snap.health.weights;
  const unit = f.weightUnit;
  const example = f.number(unit === "lb" ? 18.5 : 8.4);

  /** Número digitado ("12,5", "27.6"); NaN se não for número. */
  const parse = (text: string) => Number(text.trim().replace(/\s/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, ""));

  /** O texto do campo convertido de uma unidade para outra (o peso digitado continua o mesmo). */
  const convert = (text: string, from: WeightUnit, to: WeightUnit) => {
    const v = parse(text);
    if (!text.trim() || Number.isNaN(v)) return text;
    return f.number(Math.round(fromKg(toKg(v, from), to) * 100) / 100, { maximumFractionDigits: 2, useGrouping: false });
  };

  /**
   * Trocar a unidade converte o campo junto. Uma troca por vez: até o servidor responder, a unidade e o envio
   * ficam bloqueados. Se a escolha não for gravada, o campo volta ao texto ORIGINAL (sem reconverter nem
   * arredondar de novo), a menos que a pessoa já tenha mexido nele.
   */
  async function switchUnit(u: WeightUnit) {
    if (u === unit || switching.current || unitSaver.busy) return;
    switching.current = true;
    const original = kg;
    const converted = convert(original, unit, u);
    setKg(converted);
    try {
      if (!(await unitSaver.save({ weightUnit: u }))) setKg((text) => (text === converted ? original : text));
    } finally {
      switching.current = false;
    }
  }

  /** A pessoa digita na unidade dela; o servidor recebe sempre kg (o registro real não muda ao trocar a unidade). */
  async function add() {
    if (switching.current || unitSaver.busy) return;
    const value = parse(kg);
    if (!kg.trim() || Number.isNaN(value)) return setError(`weightPage.invalid?unit=${unit}&example=${encodeURIComponent(example)}`);
    if (await run(() => repo!.addWeight({ date: date || snap!.today, kg: f.toKg(value) }), upsertCare("weights"))) setKg("");
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
        <form className="card stack edit-only" onSubmit={(e) => { e.preventDefault(); add(); }} aria-labelledby="peso-novo" noValidate>
          <h2 id="peso-novo" style={{ fontSize: "1.0625rem" }}>{t("new")}</h2>
          <div className="field">
            <label htmlFor="kg">{t("weightIn", { unit })}</label>
            <div className="weight-entry">
              <input id="kg" className="input" value={kg} onChange={(e) => setKg(e.target.value)} inputMode="decimal" placeholder={example} />
              <div className="weight-entry__units" role="radiogroup" aria-label={t("unitLabel")}>
                {(["kg", "lb"] as const).map((u) => (
                  <button key={u} type="button" role="radio" aria-checked={unit === u} className={`filter-chip${unit === u ? " is-active" : ""}`} disabled={unitSaver.busy} onClick={() => void switchUnit(u)}>{u}</button>
                ))}
              </div>
            </div>
          </div>
          <PrefsSaveError failed={unitSaver.failed} retry={() => unitSaver.failed?.weightUnit && switchUnit(unitSaver.failed.weightUnit)} busy={unitSaver.busy} />
          <Field id="wdate" label={t("date")} type="date" value={date || snap.today} max={snap.today} onChange={setDate} />
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy || unitSaver.busy}>{t("add")}</button>
        </form>
      </main>
      <DeleteSheet error={toDelete ? error : null} open={!!toDelete} onClose={() => setToDelete(null)} title={t("deleteTitle")} text={toDelete ? t("deleteText", { weight: f.weight(toDelete.kg, 2), date: f.date(toDelete.date) }) : ""} busy={busy}
        onConfirm={async () => { if (toDelete && (await run(() => repo!.deleteHealthRecord("weights", toDelete.id), removeCare("weights", toDelete.id)))) setToDelete(null); }} />
    </>
  );
}
