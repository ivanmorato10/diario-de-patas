"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/i18n/use-format";
import { useCareText } from "@/i18n/use-care";

import { DocumentButtons, DocumentFileInput, type PickedDocument } from "@/components/document-ui";
import { useStore } from "@/data/store";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { DueBadge } from "@/components/health-ui";
import { DeleteSheet, Field, FormSheet, RowActions, removeCare, upsertCare, useCareMutation } from "@/components/care-forms";
import { IconPlus } from "@/components/icons";
import { VACCINE_KINDS, dueStatus, isSuperseded, type Vaccine, type VaccineKind } from "@/domain/health";

interface Form { kind: VaccineKind; name: string; appliedDate: string; nextDate: string; clinic: string }

export default function Vacinas() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo } = useStore();
  const { busy, error, setError, run } = useCareMutation();
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [toDelete, setToDelete] = useState<Vaccine | null>(null);
  const [label, setLabel] = useState<PickedDocument[]>([]);
  const t = useTranslations("vaccinesPage");
  const tc = useTranslations("care");
  const fmt = useFormat();
  const { dueText } = useCareText();
  const kind = (k: VaccineKind) => tc(`vaccineKinds.${k}`);

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
    if (f.appliedDate > today) return setError("vaccinesPage.appliedUpToToday");
    const prev = editing.id ? vaccines.find((v) => v.id === editing.id) : null;
    const ok = await run(async () => {
      // A foto da etiqueta/carteirinha vira um Documento (§4.2, §5).
      const doc = label[0] ? await repo!.addDocument({ title: t("labelDocTitle", { name: f.name || kind(f.kind) }).slice(0, 80), category: "vaccination_card", docDate: f.appliedDate }, label[0].doc) : null;
      return repo!.saveVaccine({ ...f, nextDate: f.nextDate || null, documentId: doc?.id ?? prev?.documentId ?? null }, editing.id);
    }, upsertCare("vaccines"));
    if (ok) setEditing(null);
  }

  return (
    <>
      <TopBar title={t("title")} back="/cuidados" emoji="💉" />
      <main className="main">
        <button type="button" className="btn btn--primary btn--block edit-only" onClick={openNew}><IconPlus /> {t("add")}</button>
        {vaccines.length === 0 ? <p className="muted">{t("empty")}</p> : null}
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {vaccines.map((v) => {
            const old = isSuperseded(v, vaccines);
            const st = old ? "none" : dueStatus(v.nextDate, today);
            return (
              <li key={v.id} className="card stack" style={{ padding: 14, gap: 6 }}>
                <div className="row-between" style={{ alignItems: "flex-start" }}>
                  <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <span className="caption">{kind(v.kind)}</span>
                    <strong style={{ overflowWrap: "anywhere" }}>{v.name}</strong>
                  </span>
                  <RowActions label={`${kind(v.kind).toLocaleLowerCase(fmt.locale)} ${v.name}`} onEdit={() => openEdit(v)} onDelete={() => setToDelete(v)} />
                </div>
                <p className="small">{t("appliedOn", { date: fmt.date(v.appliedDate) })}{v.clinic ? ` · ${v.clinic}` : ""}</p>
                {v.nextDate ? (
                  <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                    <span className="small">{t("next", { date: fmt.date(v.nextDate) })}{old ? "" : ` (${dueText(v.nextDate, today)})`}</span>
                    {old ? <span className="caption">{t("superseded")}</span> : <DueBadge status={st} />}
                    {!old && v.nextDate >= today ? <a className="btn btn--ghost btn--small" href={`/api/calendario?tipo=vacina&id=${v.id}`}>{t("reminder")}</a> : null}
                  </div>
                ) : <p className="caption">{t("noNext")}</p>}
                {(() => { const d = v.documentId ? snap.health.documents.find((x) => x.id === v.documentId) : null; return d ? <DocumentButtons doc={d} compact /> : null; })()}
              </li>
            );
          })}
        </ul>
      </main>

      <FormSheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t("editTitle") : t("newTitle")} onSubmit={submit} busy={busy} error={error}>
        {editing ? (
          <>
            <div className="field">
              <label htmlFor="vkind">{t("type")}</label>
              <select id="vkind" className="input" value={editing.form.kind} onChange={(e) => set({ kind: e.target.value as VaccineKind })}>
                {VACCINE_KINDS.map((k) => <option key={k} value={k}>{kind(k)}</option>)}
              </select>
            </div>
            <Field id="vname" label={t("name")} value={editing.form.name} onChange={(v) => set({ name: v })} maxLength={80} placeholder={t("namePlaceholder")} />
            <Field id="vapplied" label={t("applied")} type="date" max={today} value={editing.form.appliedDate} onChange={(v) => set({ appliedDate: v })} />
            <Field id="vnext" label={t("nextDose")} optional type="date" value={editing.form.nextDate} onChange={(v) => set({ nextDate: v })} hint={t("nextHint")} />
            <Field id="vclinic" label={t("clinic")} optional value={editing.form.clinic} onChange={(v) => set({ clinic: v })} maxLength={120} />
            <DocumentFileInput label={t("labelPhoto")} optional value={label} onChange={setLabel} />
            {editing.id && vaccines.find((x) => x.id === editing.id)?.documentId && !label.length ? <p className="caption">{t("hasDoc")}</p> : null}
          </>
        ) : null}
      </FormSheet>
      <DeleteSheet error={toDelete ? error : null} open={!!toDelete} onClose={() => setToDelete(null)} title={t("deleteTitle")} text={toDelete ? t("deleteText", { kind: kind(toDelete.kind), name: toDelete.name, date: fmt.date(toDelete.appliedDate) }) : ""} busy={busy}
        onConfirm={async () => { if (toDelete && (await run(() => repo!.deleteHealthRecord("vaccines", toDelete.id), removeCare("vaccines", toDelete.id)))) setToDelete(null); }} />
    </>
  );
}
