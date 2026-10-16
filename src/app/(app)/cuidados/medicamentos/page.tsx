"use client";

import { useState } from "react";

import { useStore } from "@/data/store";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { DeleteSheet, Field, FormSheet, RowActions, useCareMutation } from "@/components/care-forms";
import { IconCheck, IconPlus } from "@/components/icons";
import { formatCivilDate } from "@/domain/dates";
import { MED_REPEAT, medNextDue, medicationActive, type MedRepeat, type Medication } from "@/domain/health";

interface Form { name: string; dose: string; frequency: string; repeat: MedRepeat; startDate: string; endDate: string; notes: string }

export default function Medicamentos() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo } = useStore();
  const { busy, error, setError, run } = useCareMutation();
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [toDelete, setToDelete] = useState<Medication | null>(null);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !repo) return <main className="main"><PageLoading /></main>;
  const today = snap.today;
  const meds = snap.health.medications;
  const active = meds.filter((m) => medicationActive(m, today));
  const others = meds.filter((m) => !medicationActive(m, today));

  const openNew = () => { setError(null); setEditing({ form: { name: "", dose: "", frequency: "", repeat: "", startDate: today, endDate: "", notes: "" } }); };
  const openEdit = (m: Medication) => { setError(null); setEditing({ id: m.id, form: { name: m.name, dose: m.dose, frequency: m.frequency, repeat: m.repeat ?? "", startDate: m.startDate, endDate: m.endDate ?? "", notes: m.notes } }); };
  const set = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  const submit = async () => {
    if (!editing) return;
    const prev = editing.id ? meds.find((m) => m.id === editing.id) : null;
    if (await run(() => repo!.saveMedication({ ...editing.form, endDate: editing.form.endDate || null, lastGiven: prev?.lastGiven ?? null }, editing.id))) setEditing(null);
  };
  const markGiven = (m: Medication) => run(() => repo!.saveMedication({ ...m, lastGiven: today }, m.id));

  const row = (m: Medication) => {
    const on = medicationActive(m, today);
    return (
      <li key={m.id} className="card stack" style={{ padding: 14, gap: 6 }}>
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <span className="stack" style={{ gap: 2, minWidth: 0 }}>
            <strong style={{ overflowWrap: "anywhere" }}>{m.name}</strong>
            {m.dose || m.frequency ? <span className="small">{[m.dose, m.frequency].filter(Boolean).join(" · ")}</span> : null}
          </span>
          <RowActions label={`medicamento ${m.name}`} onEdit={() => openEdit(m)} onDelete={() => setToDelete(m)} />
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {on ? <span className="due due--ok"><IconCheck size={14} /> Em uso</span> : null}
          <span className="caption">
            {m.startDate > today ? `Começa em ${formatCivilDate(m.startDate)}` : `Desde ${formatCivilDate(m.startDate)}`}
            {m.endDate ? ` · ${m.endDate < today ? "terminou" : "até"} ${formatCivilDate(m.endDate)}` : " · sem data de fim"}
          </span>
        </div>
        {m.repeat ? (() => {
          const due = medNextDue(m);
          return (
            <div className="med-due">
              <span>🔔 {MED_REPEAT[m.repeat]} · {due ? <>próxima dose: <strong>{formatCivilDate(due)}</strong>{due < today ? " (atrasada)" : due === today ? " (hoje)" : ""}</> : "tratamento encerrado"}{m.lastGiven ? ` · última: ${formatCivilDate(m.lastGiven)}` : ""}</span>
              {due && due <= today ? <button type="button" className="btn btn--secondary btn--small" onClick={() => markGiven(m)}>Já dei hoje</button> : null}
              {due ? <a className="btn btn--ghost btn--small" href={`/api/calendario?tipo=medicamento&id=${m.id}`}>📅 Lembrete no celular</a> : null}
            </div>
          );
        })() : null}
        {m.notes ? <p className="small" style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{m.notes}</p> : null}
      </li>
    );
  };

  return (
    <>
      <TopBar title="Medicamentos" back="/cuidados" />
      <main className="main">
        <button type="button" className="btn btn--primary btn--block" onClick={openNew}><IconPlus /> Adicionar medicamento</button>
        <p className="page-note">Anote como o veterinário orientou.</p>
        {meds.length === 0 ? <p className="muted">Nenhum medicamento registrado.</p> : null}
        {active.length ? (
          <section className="stack" aria-labelledby="em-uso">
            <h2 id="em-uso">Em uso</h2>
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>{active.map(row)}</ul>
          </section>
        ) : null}
        {others.length ? (
          <section className="stack" aria-labelledby="outros">
            <h2 id="outros">Encerrados ou ainda não iniciados</h2>
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>{others.map(row)}</ul>
          </section>
        ) : null}
      </main>

      <FormSheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar medicamento" : "Novo medicamento"} onSubmit={submit} busy={busy} error={error}>
        {editing ? (
          <>
            <Field id="mname" label="Nome" value={editing.form.name} onChange={(v) => set({ name: v })} maxLength={80} />
            <Field id="mdose" label="Dose" optional value={editing.form.dose} onChange={(v) => set({ dose: v })} maxLength={80} placeholder="Como está na receita" />
            <div className="field">
              <label htmlFor="mrepeat">Repetir e avisar</label>
              <select id="mrepeat" className="select" value={editing.form.repeat} onChange={(e) => set({ repeat: e.target.value as MedRepeat })}>
                {(Object.keys(MED_REPEAT) as MedRepeat[]).map((k) => <option key={k} value={k}>{MED_REPEAT[k]}</option>)}
              </select>
              <span className="caption">O app avisa no dia da dose.</span>
            </div>
            <Field id="mfreq" label="Horário / como dar" optional value={editing.form.frequency} onChange={(v) => set({ frequency: v })} maxLength={80} placeholder="Ex.: de manhã, com comida" />
            <Field id="mstart" label="Início" type="date" value={editing.form.startDate} onChange={(v) => set({ startDate: v })} />
            <Field id="mend" label="Fim" optional type="date" value={editing.form.endDate} onChange={(v) => set({ endDate: v })} hint="Sem fim, o medicamento aparece como em uso." />
            <Field id="mnotes" label="Observações" optional multiline value={editing.form.notes} onChange={(v) => set({ notes: v })} maxLength={500} />
          </>
        ) : null}
      </FormSheet>
      <DeleteSheet open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir este medicamento?" text={toDelete ? `${toDelete.name}.` : ""} busy={busy}
        onConfirm={async () => { if (toDelete && (await run(() => repo!.deleteHealthRecord("medications", toDelete.id)))) setToDelete(null); }} />
    </>
  );
}
