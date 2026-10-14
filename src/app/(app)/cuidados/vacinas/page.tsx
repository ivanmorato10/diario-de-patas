"use client";

import { REAL_MODE } from "@/config/mode";
import { useState } from "react";

import { DocumentButtons, DocumentFileInput, type PickedDocument } from "@/components/document-ui";
import { useStore } from "@/data/store";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { DueBadge, HealthDisclaimer } from "@/components/health-ui";
import { DeleteSheet, Field, FormSheet, RowActions, useCareMutation } from "@/components/care-forms";
import { IconPlus } from "@/components/icons";
import { formatCivilDate } from "@/domain/dates";
import { VACCINE_KINDS, dueStatus, dueText, isSuperseded, type Vaccine, type VaccineKind } from "@/domain/health";

interface Form { kind: VaccineKind; name: string; appliedDate: string; nextDate: string; clinic: string }

export default function Vacinas() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo } = useStore();
  const { busy, error, setError, run } = useCareMutation();
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [toDelete, setToDelete] = useState<Vaccine | null>(null);
  const [label, setLabel] = useState<PickedDocument[]>([]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !repo) return <main className="main"><PageLoading /></main>;
  const { vaccines } = snap.health;
  const today = snap.today;

  const openNew = () => { setError(null); setLabel([]); setEditing({ form: { kind: "vaccine", name: "", appliedDate: today, nextDate: "", clinic: "" } }); };
  const openEdit = (v: Vaccine) => { setError(null); setLabel([]); setEditing({ id: v.id, form: { kind: v.kind, name: v.name, appliedDate: v.appliedDate, nextDate: v.nextDate ?? "", clinic: v.clinic } }); };
  const set = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  async function submit() {
    if (!editing) return;
    const f = editing.form;
    if (f.appliedDate > today) return setError("A data aplicada deve ser até hoje.");
    const prev = editing.id ? vaccines.find((v) => v.id === editing.id) : null;
    const ok = await run(async () => {
      // A foto da etiqueta/carteirinha vira um Documento (§4.2, §5).
      const doc = label[0] ? await repo!.addDocument({ title: `Etiqueta: ${f.name || "vacina"}`.slice(0, 80), category: "vaccination_card", docDate: f.appliedDate }, label[0].doc) : null;
      await repo!.saveVaccine({ ...f, nextDate: f.nextDate || null, documentId: doc?.id ?? prev?.documentId ?? null }, editing.id);
    });
    if (ok) setEditing(null);
  }

  return (
    <>
      <TopBar title="Vacinas e vermífugos" back="/cuidados" />
      <main className="main">
        <button type="button" className="btn btn--primary btn--block" onClick={openNew}><IconPlus /> Adicionar registro</button>
        {vaccines.length === 0 ? <p className="muted">Nenhum registro ainda. Anote vacinas, vermífugos e antipulgas com a data aplicada e, se souber, a próxima dose.</p> : null}
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {vaccines.map((v) => {
            const old = isSuperseded(v, vaccines);
            const st = old ? "none" : dueStatus(v.nextDate, today);
            return (
              <li key={v.id} className="card stack" style={{ padding: 14, gap: 6 }}>
                <div className="row-between" style={{ alignItems: "flex-start" }}>
                  <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <span className="caption">{VACCINE_KINDS[v.kind]}</span>
                    <strong style={{ overflowWrap: "anywhere" }}>{v.name}</strong>
                  </span>
                  <RowActions label={`${VACCINE_KINDS[v.kind].toLowerCase()} ${v.name}`} onEdit={() => openEdit(v)} onDelete={() => setToDelete(v)} />
                </div>
                <p className="small">Aplicada em {formatCivilDate(v.appliedDate)}{v.clinic ? ` · ${v.clinic}` : ""}</p>
                {v.nextDate ? (
                  <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                    <span className="small">Próxima: {formatCivilDate(v.nextDate)}{old ? "" : ` (${dueText(v.nextDate, today)})`}</span>
                    {old ? <span className="caption">Substituída por uma dose mais nova</span> : <DueBadge status={st} />}
                    {!old && REAL_MODE && v.nextDate >= today ? <a className="btn btn--ghost btn--small" href={`/api/calendario?tipo=vacina&id=${v.id}`}>📅 Lembrete no celular</a> : null}
                  </div>
                ) : <p className="caption">Sem próxima dose anotada.</p>}
                {(() => { const d = v.documentId ? snap.health.documents.find((x) => x.id === v.documentId) : null; return d ? <DocumentButtons doc={d} compact /> : null; })()}
              </li>
            );
          })}
        </ul>
        <HealthDisclaimer />
      </main>

      <FormSheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar registro" : "Novo registro"} onSubmit={submit} busy={busy} error={error}>
        {editing ? (
          <>
            <div className="field">
              <label htmlFor="vkind">Tipo</label>
              <select id="vkind" className="input" value={editing.form.kind} onChange={(e) => set({ kind: e.target.value as VaccineKind })}>
                {Object.entries(VACCINE_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <Field id="vname" label="Nome" value={editing.form.name} onChange={(v) => set({ name: v })} maxLength={80} placeholder="Ex.: V10, antirrábica" />
            <Field id="vapplied" label="Data aplicada" type="date" max={today} value={editing.form.appliedDate} onChange={(v) => set({ appliedDate: v })} />
            <Field id="vnext" label="Próxima dose" optional type="date" value={editing.form.nextDate} onChange={(v) => set({ nextDate: v })} hint="Usada para avisar quando estiver chegando." />
            <Field id="vclinic" label="Veterinário ou clínica" optional value={editing.form.clinic} onChange={(v) => set({ clinic: v })} maxLength={120} />
            <DocumentFileInput label="Foto da etiqueta ou da carteirinha" optional value={label} onChange={setLabel} />
            {editing.id && vaccines.find((x) => x.id === editing.id)?.documentId && !label.length ? <p className="caption">Já tem um documento ligado. Escolher outro arquivo cria um documento novo.</p> : null}
          </>
        ) : null}
      </FormSheet>
      <DeleteSheet open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir este registro?" text={toDelete ? `${VACCINE_KINDS[toDelete.kind]} ${toDelete.name}, aplicada em ${formatCivilDate(toDelete.appliedDate)}.` : ""} busy={busy}
        onConfirm={async () => { if (toDelete && (await run(() => repo!.deleteHealthRecord("vaccines", toDelete.id)))) setToDelete(null); }} />
    </>
  );
}
