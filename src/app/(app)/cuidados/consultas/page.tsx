"use client";

import { mapsUrl } from "@/lib/maps";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/i18n/use-format";
import { useCareText } from "@/i18n/use-care";

import { DocumentButtons, DocumentFileInput, type PickedDocument } from "@/components/document-ui";
import { useStore } from "@/data/store";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { DueBadge, HealthDisclaimer } from "@/components/health-ui";
import { DeleteSheet, Field, FormSheet, RowActions, removeCare, upsertCare, useCareMutation } from "@/components/care-forms";
import { IconCamera, IconPlus } from "@/components/icons";
import { dueStatus, type Visit } from "@/domain/health";

interface Form { date: string; time: string; clinic: string; vet: string; reason: string; notes: string; nextDate: string }

export default function Consultas() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo } = useStore();
  const { busy, error, setError, run } = useCareMutation();
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [toDelete, setToDelete] = useState<Visit | null>(null);
  const [attach, setAttach] = useState<PickedDocument[]>([]);
  const t = useTranslations("visitsPage");
  const tc = useTranslations("care");
  const fmt = useFormat();
  const { dueText } = useCareText();

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !repo) return <main className="main"><PageLoading /></main>;
  const { visits } = snap.health;
  const today = snap.today;
  const latestId = visits.find((v) => v.date <= today)?.id;
  const vetContacts = snap.health.contacts.filter((c) => c.kind === "vet" || c.kind === "clinic" || c.kind === "emergency");

  const openNew = () => { setError(null); setAttach([]); setEditing({ form: { date: today, time: "", clinic: "", vet: "", reason: "", notes: "", nextDate: "" } }); };
  const openEdit = (v: Visit) => { setError(null); setAttach([]); setEditing({ id: v.id, form: { date: v.date, time: v.time ?? "", clinic: v.clinic, vet: v.vet, reason: v.reason, notes: v.notes, nextDate: v.nextDate ?? "" } }); };
  const set = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  async function submit() {
    if (!editing) return;
    const f = editing.form;
    const prev = editing.id ? visits.find((v) => v.id === editing.id) : null;
    const ok = await run(async () => {
      // Anexos viram Documentos (§4.3, §5) ligados à consulta.
      const ids = [...(prev?.documentIds ?? [])];
      for (const a of attach) ids.push((await repo!.addDocument({ title: t("attachTitle", { date: fmt.date(f.date, "numeric"), name: a.name }).slice(0, 80), category: "exams", docDate: f.date }, a.doc)).id);
      return repo!.saveVisit({ ...f, nextDate: f.nextDate || null, documentIds: ids }, editing.id);
    }, upsertCare("visits"));
    if (ok) setEditing(null);
  }

  return (
    <>
      <TopBar title={t("title")} back="/cuidados" emoji="🩺" />
      <main className="main">
        <button type="button" className="btn btn--primary btn--block edit-only" onClick={openNew}><IconPlus /> {t("add")}</button>
        {visits.length === 0 ? <p className="muted">{t("empty")}</p> : null}
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {visits.map((v) => (
            <li key={v.id} className="card stack" style={{ padding: 14, gap: 6 }}>
              <div className="row-between" style={{ alignItems: "flex-start" }}>
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <span className="caption">{fmt.date(v.date)}{v.time ? ` ${t("at", { time: fmt.clock(v.time) })}` : ""}{v.date > today ? <> · <span className="chip" style={{ padding: "1px 8px" }}>{t("scheduled")} · {dueText(v.date, today)}</span></> : null}</span>
                  <strong style={{ overflowWrap: "anywhere" }}>{v.reason || t("visit")}</strong>
                </span>
                <RowActions label={t("rowLabel", { date: fmt.date(v.date) })} onEdit={() => openEdit(v)} onDelete={() => setToDelete(v)} />
              </div>
              {v.clinic || v.vet ? <p className="small">{[v.clinic, v.vet].filter(Boolean).join(" · ")}{v.clinic ? <> · <a href={mapsUrl(v.clinic)} target="_blank" rel="noopener">{t("map")}</a></> : null}</p> : null}
              {(v.date > today || (v.nextDate && v.nextDate >= today)) ? <a className="btn btn--ghost btn--small" style={{ alignSelf: "flex-start" }} href={`/api/calendario?tipo=consulta&id=${v.id}`}>{t("calendar")}</a> : null}
              {v.notes ? <p className="small" style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{v.notes}</p> : null}
              {v.nextDate ? (
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  <span className="small">{t("next", { date: fmt.date(v.nextDate) })}{v.id === latestId ? ` (${dueText(v.nextDate, today)})` : ""}</span>
                  {v.id === latestId ? <DueBadge status={dueStatus(v.nextDate, today)} label={dueStatus(v.nextDate, today) === "overdue" ? t("overdue") : dueStatus(v.nextDate, today) === "soon" ? t("soon") : t("set")} /> : null}
                </div>
              ) : null}
              {v.documentIds.length ? (
                <div className="stack" style={{ gap: 6 }}>
                  <span className="caption">{t("attachments")}</span>
                  {v.documentIds.map((id) => snap.health.documents.find((d) => d.id === id)).filter((d) => !!d).map((d) => <DocumentButtons key={d!.id} doc={d!} compact />)}
                </div>
              ) : null}
              {v.date <= today ? <Link href={`/guardar?missao=visita-ao-veterinario&data=${v.date}`} className="btn btn--ghost btn--small" style={{ alignSelf: "flex-start" }}>
                <IconCamera size={18} /> {t("savePhoto")}
              </Link> : null}
            </li>
          ))}
        </ul>
        <HealthDisclaimer />
      </main>

      <FormSheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t("editTitle") : t("newTitle")} onSubmit={submit} busy={busy} error={error}>
        {editing ? (
          <>
            <Field id="cdate" label={t("date")} type="date" value={editing.form.date} onChange={(v) => set({ date: v })} />
            <Field id="ctime" label={t("time")} optional type="time" value={editing.form.time} onChange={(v) => set({ time: v })} />
            {vetContacts.length ? (
              <div className="field">
                <label htmlFor="ccontact">{t("useContact")}</label>
                <select id="ccontact" className="select" value="" onChange={(e) => {
                  const c = vetContacts.find((x) => x.id === e.target.value);
                  if (c) set(c.kind === "clinic" || c.kind === "emergency" ? { clinic: c.name } : { vet: c.name });
                }}>
                  <option value="">{t("pickContact")}</option>
                  {vetContacts.map((c) => <option key={c.id} value={c.id}>{tc(`contactKinds.${c.kind}`)}: {c.name}</option>)}
                </select>
              </div>
            ) : <p className="caption">{t.rich("contactTip", { link: (c) => <Link href="/cuidados/contatos">{c}</Link> })}</p>}
            <Field id="cclinic" label={t("clinic")} optional value={editing.form.clinic} onChange={(v) => set({ clinic: v })} maxLength={120} />
            <Field id="cvet" label={t("vet")} optional value={editing.form.vet} onChange={(v) => set({ vet: v })} maxLength={120} />
            <Field id="creason" label={t("reason")} optional value={editing.form.reason} onChange={(v) => set({ reason: v })} maxLength={200} placeholder={t("reasonPlaceholder")} />
            <Field id="cnotes" label={t("notes")} optional multiline value={editing.form.notes} onChange={(v) => set({ notes: v })} maxLength={2000} />
            <Field id="cnext" label={t("nextVisit")} optional type="date" value={editing.form.nextDate} onChange={(v) => set({ nextDate: v })} />
            <DocumentFileInput label={t("attachLabel")} optional multiple value={attach} onChange={setAttach} />
          </>
        ) : null}
      </FormSheet>
      <DeleteSheet error={toDelete ? error : null} open={!!toDelete} onClose={() => setToDelete(null)} title={t("deleteTitle")} text={toDelete ? t("deleteText", { date: fmt.date(toDelete.date) }) : ""} busy={busy}
        onConfirm={async () => { if (toDelete && (await run(() => repo!.deleteHealthRecord("visits", toDelete.id), removeCare("visits", toDelete.id)))) setToDelete(null); }} />
    </>
  );
}
