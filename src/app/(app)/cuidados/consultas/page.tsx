"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteHealthRecord, saveVisit } from "@/data/demo-repository";
import { useStore } from "@/data/store";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { DueBadge, HealthDisclaimer } from "@/components/health-ui";
import { DeleteSheet, Field, FormSheet, RowActions, useCareMutation } from "@/components/care-forms";
import { IconCamera, IconPlus } from "@/components/icons";
import { formatCivilDate } from "@/domain/dates";
import { dueStatus, dueText, type Visit } from "@/domain/health";

interface Form { date: string; clinic: string; vet: string; reason: string; notes: string; nextDate: string }

export default function Consultas() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { db } = useStore();
  const { busy, error, setError, run } = useCareMutation();
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [toDelete, setToDelete] = useState<Visit | null>(null);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !db) return <main className="main"><PageLoading /></main>;
  const { visits } = snap.health;
  const today = snap.today;
  const latestId = visits[0]?.id;

  const openNew = () => { setError(null); setEditing({ form: { date: today, clinic: "", vet: "", reason: "", notes: "", nextDate: "" } }); };
  const openEdit = (v: Visit) => { setError(null); setEditing({ id: v.id, form: { date: v.date, clinic: v.clinic, vet: v.vet, reason: v.reason, notes: v.notes, nextDate: v.nextDate ?? "" } }); };
  const set = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  async function submit() {
    if (!editing) return;
    const f = editing.form;
    if (f.date > today) return setError("A data da consulta deve ser até hoje. Para uma consulta marcada, use “Próxima consulta”.");
    const prev = editing.id ? visits.find((v) => v.id === editing.id) : null;
    if (await run(() => saveVisit(db!, { ...f, nextDate: f.nextDate || null, documentIds: prev?.documentIds ?? [] }, editing.id))) setEditing(null);
  }

  return (
    <>
      <TopBar title="Consultas e visitas" back="/cuidados" />
      <main className="main">
        <button type="button" className="btn btn--primary btn--block" onClick={openNew}><IconPlus /> Registrar consulta</button>
        {visits.length === 0 ? <p className="muted">Nenhuma consulta registrada. Anote data, clínica, motivo e as orientações que recebeu.</p> : null}
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {visits.map((v) => (
            <li key={v.id} className="card stack" style={{ padding: 14, gap: 6 }}>
              <div className="row-between" style={{ alignItems: "flex-start" }}>
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <span className="caption">{formatCivilDate(v.date)}</span>
                  <strong style={{ overflowWrap: "anywhere" }}>{v.reason || "Consulta"}</strong>
                </span>
                <RowActions label={`consulta de ${formatCivilDate(v.date)}`} onEdit={() => openEdit(v)} onDelete={() => setToDelete(v)} />
              </div>
              {v.clinic || v.vet ? <p className="small">{[v.clinic, v.vet].filter(Boolean).join(" · ")}</p> : null}
              {v.notes ? <p className="small" style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{v.notes}</p> : null}
              {v.nextDate ? (
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  <span className="small">Próxima consulta: {formatCivilDate(v.nextDate)}{v.id === latestId ? ` (${dueText(v.nextDate, today)})` : ""}</span>
                  {v.id === latestId ? <DueBadge status={dueStatus(v.nextDate, today)} label={dueStatus(v.nextDate, today) === "overdue" ? "Atrasada" : dueStatus(v.nextDate, today) === "soon" ? "Em breve" : "Marcada"} /> : null}
                </div>
              ) : null}
              <Link href={`/guardar?missao=visita-ao-veterinario&data=${v.date}`} className="btn btn--ghost btn--small" style={{ alignSelf: "flex-start" }}>
                <IconCamera size={18} /> Guardar uma foto desta visita
              </Link>
            </li>
          ))}
        </ul>
        <HealthDisclaimer />
      </main>

      <FormSheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar consulta" : "Nova consulta"} onSubmit={submit} busy={busy} error={error}>
        {editing ? (
          <>
            <Field id="cdate" label="Data" type="date" max={today} value={editing.form.date} onChange={(v) => set({ date: v })} />
            <Field id="cclinic" label="Clínica" optional value={editing.form.clinic} onChange={(v) => set({ clinic: v })} maxLength={120} />
            <Field id="cvet" label="Veterinário" optional value={editing.form.vet} onChange={(v) => set({ vet: v })} maxLength={120} />
            <Field id="creason" label="Motivo" optional value={editing.form.reason} onChange={(v) => set({ reason: v })} maxLength={200} placeholder="Ex.: consulta de rotina" />
            <Field id="cnotes" label="O que foi feito / orientações" optional multiline value={editing.form.notes} onChange={(v) => set({ notes: v })} maxLength={2000} />
            <Field id="cnext" label="Próxima consulta" optional type="date" value={editing.form.nextDate} onChange={(v) => set({ nextDate: v })} />
          </>
        ) : null}
      </FormSheet>
      <DeleteSheet open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir esta consulta?" text={toDelete ? `Consulta de ${formatCivilDate(toDelete.date)}.` : ""} busy={busy}
        onConfirm={async () => { if (toDelete && (await run(() => deleteHealthRecord(db!, "visits", toDelete.id)))) setToDelete(null); }} />
    </>
  );
}
