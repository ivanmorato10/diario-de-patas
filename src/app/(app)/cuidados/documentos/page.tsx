"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/i18n/use-format";
import { useCareText } from "@/i18n/use-care";

import { useStore } from "@/data/store";
import { LIMITS } from "@/config/business";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { DueBadge } from "@/components/health-ui";
import { DeleteSheet, Field, FormSheet, RowActions, removeCare, upsertCare, useCareMutation } from "@/components/care-forms";
import { DocumentButtons, DocumentFileInput, DocumentThumb, type PickedDocument } from "@/components/document-ui";
import { IconPlus } from "@/components/icons";
import { DOCUMENT_CATEGORIES, expiryStatus, type DocumentCategory, type HealthDocument } from "@/domain/documents";

interface Form { title: string; category: DocumentCategory; docDate: string; expiresOn: string; notes: string }

export default function Documentos() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo } = useStore();
  const { busy, error, setError, run } = useCareMutation();
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [file, setFile] = useState<PickedDocument[]>([]);
  const [toDelete, setToDelete] = useState<HealthDocument | null>(null);
  const t = useTranslations("docsPage");
  const tc = useTranslations("care");
  const fmt = useFormat();
  const { dueText } = useCareText();

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
    if (!editing.id && !file[0]) return setError("docsPage.pickFile");
    const ok = await run(() => (editing.id ? repo!.updateDocument(editing.id, meta) : repo!.addDocument(meta, file[0].doc)), upsertCare("documents"));
    if (ok) setEditing(null);
  }

  return (
    <>
      <TopBar title={t("title")} back="/cuidados" emoji="📄" />
      <main className="main">
        <p className="page-note">{t("note")}</p>
        <button type="button" className="btn btn--primary btn--block edit-only" onClick={openNew} disabled={full}><IconPlus /> {t("add")}</button>
        {/* Limite só aparece quando estiver perto. */}
        {LIMITS.maxDocuments - docs.length <= 3 ? <p className="caption">{full ? t("full", { max: LIMITS.maxDocuments }) : t("left", { count: LIMITS.maxDocuments - docs.length })}</p> : null}
        {docs.length === 0 ? <p className="muted">{t("empty")}</p> : null}
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {docs.map((d) => {
            const st = expiryStatus(d.expiresOn, today);
            return (
              <li key={d.id} className="card stack" style={{ padding: 14, gap: 8 }}>
                <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
                  <DocumentThumb doc={d} />
                  <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                    <span className="caption">{tc(`docCategories.${d.category}`)}</span>
                    <strong style={{ overflowWrap: "anywhere" }}>{d.title}</strong>
                    {d.docDate ? <span className="small">{t("date", { date: fmt.date(d.docDate) })}</span> : null}
                  </span>
                  <RowActions label={t("rowLabel", { title: d.title })} onEdit={() => openEdit(d)} onDelete={() => setToDelete(d)} />
                </div>
                {d.expiresOn ? (
                  <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                    <span className="small">{t("expires", { date: fmt.date(d.expiresOn) })} ({dueText(d.expiresOn, today)})</span>
                    <DueBadge status={st} label={tc(`expiry.${st}`)} />
                  </div>
                ) : null}
                {d.notes ? <p className="small" style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{d.notes}</p> : null}
                <DocumentButtons doc={d} />
              </li>
            );
          })}
        </ul>
      </main>

      <FormSheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t("editTitle") : t("newTitle")} onSubmit={submit} busy={busy} error={error}>
        {editing ? (
          <>
            {!editing.id ? <DocumentFileInput label={t("file")} value={file} onChange={(f) => { setFile(f); if (!editing.form.title && f[0]) set({ title: f[0].name.replace(/\.[^.]+$/, "").slice(0, 80) }); }} /> : null}
            <Field id="dtitle" label={t("titleField")} value={editing.form.title} onChange={(v) => set({ title: v })} maxLength={80} />
            <div className="field">
              <label htmlFor="dcat">{t("category")}</label>
              <select id="dcat" className="input" value={editing.form.category} onChange={(e) => set({ category: e.target.value as DocumentCategory })}>
                {DOCUMENT_CATEGORIES.map((k) => <option key={k} value={k}>{tc(`docCategories.${k}`)}</option>)}
              </select>
            </div>
            <Field id="ddate" label={t("docDate")} optional type="date" value={editing.form.docDate} onChange={(v) => set({ docDate: v })} />
            <Field id="dexp" label={t("expiry")} optional type="date" value={editing.form.expiresOn} onChange={(v) => set({ expiresOn: v })} hint={t("expiryHint")} />
            <Field id="dnotes" label={t("notes")} optional multiline value={editing.form.notes} onChange={(v) => set({ notes: v })} maxLength={500} />
          </>
        ) : null}
      </FormSheet>
      <DeleteSheet error={toDelete ? error : null} open={!!toDelete} onClose={() => setToDelete(null)} title={t("deleteTitle")} text={toDelete ? t("deleteText", { title: toDelete.title }) : ""} busy={busy}
        onConfirm={async () => { if (toDelete && (await run(() => repo!.deleteDocument(toDelete.id), removeCare("documents", toDelete.id)))) setToDelete(null); }} />
    </>
  );
}
