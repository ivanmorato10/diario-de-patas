"use client";

import { useState } from "react";

import { useStore } from "@/data/store";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { HealthDisclaimer, WeightChart } from "@/components/health-ui";
import { DeleteSheet, Field, RowActions, useCareMutation } from "@/components/care-forms";
import { formatCivilDate } from "@/domain/dates";
import type { WeightRecord } from "@/domain/health";

export default function Peso() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo } = useStore();
  const { busy, error, setError, run } = useCareMutation();
  const [date, setDate] = useState("");
  const [kg, setKg] = useState("");
  const [toDelete, setToDelete] = useState<WeightRecord | null>(null);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !repo) return <main className="main"><PageLoading /></main>;
  const weights = snap.health.weights;
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  async function add() {
    const value = Number(kg.replace(",", "."));
    if (!kg.trim() || Number.isNaN(value)) return setError("Informe o peso em kg, por exemplo 8,4.");
    if (await run(() => repo!.addWeight({ date: date || snap!.today, kg: value }))) setKg("");
  }

  return (
    <>
      <TopBar title="Peso" back="/cuidados" />
      <main className="main">
        <section className="card stack" aria-labelledby="peso-hist">
          <h2 id="peso-hist" style={{ fontSize: "1.0625rem" }}>Histórico</h2>
          {weights.length >= 2 ? <WeightChart weights={weights} /> : <p className="small muted">{weights.length === 1 ? "Com mais um registro aparece o gráfico." : "Nenhum peso registrado ainda."}</p>}
          {weights.length ? (
            <table className="data-table">
              <caption className="sr-only">Registros de peso</caption>
              <thead><tr><th scope="col">Data</th><th scope="col">Peso</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {[...weights].reverse().map((w) => (
                  <tr key={w.id}>
                    <td>{formatCivilDate(w.date)}</td>
                    <td>{fmt(w.kg)} kg</td>
                    <td style={{ textAlign: "right" }}><RowActions label={`peso de ${formatCivilDate(w.date)}`} onDelete={() => setToDelete(w)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); add(); }} aria-labelledby="peso-novo" noValidate>
          <h2 id="peso-novo" style={{ fontSize: "1.0625rem" }}>Novo registro</h2>
          <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 140px" }}><Field id="kg" label="Peso (kg)" value={kg} onChange={setKg} inputMode="decimal" placeholder="8,4" /></div>
            <div style={{ flex: "1 1 140px" }}><Field id="wdate" label="Data" type="date" value={date || snap.today} max={snap.today} onChange={setDate} /></div>
          </div>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>Adicionar peso</button>
        </form>
        <HealthDisclaimer />
      </main>
      <DeleteSheet open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir este peso?" text={toDelete ? `${fmt(toDelete.kg)} kg em ${formatCivilDate(toDelete.date)}.` : ""} busy={busy}
        onConfirm={async () => { if (toDelete && (await run(() => repo!.deleteHealthRecord("weights", toDelete.id)))) setToDelete(null); }} />
    </>
  );
}
