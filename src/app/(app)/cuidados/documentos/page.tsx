"use client";

import { useState } from "react";

import { useStore } from "@/data/store";
import { LIMITS } from "@/config/business";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { DueBadge } from "@/components/health-ui";
import { DeleteSheet, Field, FormSheet, RowActions, useCareMutation } from "@/components/care-forms";
import { DocumentButtons, DocumentFileInput, DocumentThumb, type PickedDocument } from "@/components/document-ui";
import { IconPlus } from "@/components/icons";
import { formatCivilDate } from "@/domain/dates";
import { dueText } from "@/domain/health";
import { DOCUMENT_CATEGORIES, EXPIRY_LABEL, expiryStatus, type DocumentCategory, type HealthDocument } from "@/domain/documents";

interface Form { title: string; category: DocumentCategory; docDate: string; expiresOn: string; notes: string }

export default function Documentos() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo } = useStore();
  const { busy, error, setError, run } = useCareMutation();
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [file, setFile] = useState<PickedDocument[]>([]);
  const [toDelete, setToDelete] = useState<HealthDocument | null>(null);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !repo) return <main className="main"><PageLoading /></main>;
  const docs = snap.health.documents;
  const today = snap.today;
  const full = docs.length >= LIMITS.maxDocuments;

  const openNew = () => { setError(null); setFile([]); setEditing({ form: { title: "", category: "vaccination_card", docDate: "", expiresOn: "", notes: "" } }); };
  const openEdit = (d: HealthDocument) => { setError(null); setFile([]); setEditing({ id: d.id, form: { title: d.title, category: d.category, docDate: d.docDate ?? "", expiresOn: d.expiresOn ?? "", notes: d.notes } }); };
  const set = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  async function submit() {
    if (!editing) return;
    const meta = { ...editing.form, docDate: editing.form.docDate || null, expiresOn: editing.form.expiresOn || null };
    if (!editing.id && !file[0]) return setError("Escolha o arquivo do documento.");
    const ok = await run(() => (editing.id ? repo!.updateDocument(editing.id, meta) : repo!.addDocument(meta, file[0].doc)));
    if (ok) setEditing(null);
  }

  return (
    <>
      <TopBar title="Documentos" back="/cuidados" />
      <main className="main">
        <p className="muted">Carteira de vacinação, RG pet, exames, receitas… guardados só neste aparelho. Documentos nunca aparecem no Diário, nos Álbuns ou em links compartilhados.</p>
        <button type="button" className="btn btn--primary btn--block" onClick={openNew} disabled={full}><IconPlus /> Adicionar documento</button>
        <p className="caption">{docs.length} de {LIMITS.maxDocuments} documentos nesta versão de teste{full ? " — exclua algum para guardar outro." : "."}</p>
        {docs.length === 0 ? <p className="muted">Nenhum documento ainda.</p> : null}
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {docs.map((d) => {
            const st = expiryStatus(d.expiresOn, today);
            return (
              <li key={d.id} className="card stack" style={{ padding: 14, gap: 8 }}>
                <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
                  <DocumentThumb doc={d} />
                  <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                    <span className="caption">{DOCUMENT_CATEGORIES[d.category]}</span>
                    <strong style={{ overflowWrap: "anywhere" }}>{d.title}</strong>
                    {d.docDate ? <span className="small">Data: {formatCivilDate(d.docDate)}</span> : null}
                  </span>
                  <RowActions label={`documento ${d.title}`} onEdit={() => openEdit(d)} onDelete={() => setToDelete(d)} />
                </div>
                {d.expiresOn ? (
                  <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                    <span className="small">Validade: {formatCivilDate(d.expiresOn)} ({dueText(d.expiresOn, today)})</span>
                    <DueBadge status={st} label={EXPIRY_LABEL[st]} />
                  </div>
                ) : null}
                {d.notes ? <p className="small" style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{d.notes}</p> : null}
                <DocumentButtons doc={d} />
              </li>
            );
          })}
        </ul>
      </main>

      <FormSheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar documento" : "Novo documento"} onSubmit={submit} busy={busy} error={error}>
        {editing ? (
          <>
            {!editing.id ? <DocumentFileInput label="Arquivo" value={file} onChange={(f) => { setFile(f); if (!editing.form.title && f[0]) set({ title: f[0].name.replace(/\.[^.]+$/, "").slice(0, 80) }); }} /> : null}
            <Field id="dtitle" label="Título" value={editing.form.title} onChange={(v) => set({ title: v })} maxLength={80} />
            <div className="field">
              <label htmlFor="dcat">Categoria</label>
              <select id="dcat" className="input" value={editing.form.category} onChange={(e) => set({ category: e.target.value as DocumentCategory })}>
                {Object.entries(DOCUMENT_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <Field id="ddate" label="Data do documento" optional type="date" value={editing.form.docDate} onChange={(v) => set({ docDate: v })} />
            <Field id="dexp" label="Validade" optional type="date" value={editing.form.expiresOn} onChange={(v) => set({ expiresOn: v })} hint="Avisamos quando faltar 30 dias ou menos." />
            <Field id="dnotes" label="Observações" optional multiline value={editing.form.notes} onChange={(v) => set({ notes: v })} maxLength={500} />
          </>
        ) : null}
      </FormSheet>
      <DeleteSheet open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir este documento?" text={toDelete ? `“${toDelete.title}” e o arquivo serão apagados deste aparelho.` : ""} busy={busy}
        onConfirm={async () => { if (toDelete && (await run(() => repo!.deleteDocument(toDelete.id)))) setToDelete(null); }} />
    </>
  );
}
