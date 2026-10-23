"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/i18n/use-format";

import { useStore } from "@/data/store";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { DeleteSheet, Field, FormSheet, RowActions, removeCare, upsertCare, useCareMutation } from "@/components/care-forms";
import { IconCheck, IconPlus } from "@/components/icons";
import { MED_REPEAT, medNextDue, medicationActive, type MedRepeat, type Medication } from "@/domain/health";

interface Form { name: string; dose: string; frequency: string; repeat: MedRepeat; startDate: string; endDate: string; notes: string }

export default function Medicamentos() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo } = useStore();
  const { busy, error, setError, run } = useCareMutation();
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [toDelete, setToDelete] = useState<Medication | null>(null);
  const t = useTranslations("medsPage");
  const tc = useTranslations("care");
  const fmt = useFormat();
  const date = fmt.date;

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
    if (await run(() => repo!.saveMedication({ ...editing.form, endDate: editing.form.endDate || null, lastGiven: prev?.lastGiven ?? null }, editing.id), upsertCare("medications"))) setEditing(null);
  };
  const markGiven = (m: Medication) => run(() => repo!.saveMedication({ ...m, lastGiven: today }, m.id), upsertCare("medications"));

  const row = (m: Medication) => {
    const on = medicationActive(m, today);
    return (
      <li key={m.id} className="card stack" style={{ padding: 14, gap: 6 }}>
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <span className="stack" style={{ gap: 2, minWidth: 0 }}>
            <strong style={{ overflowWrap: "anywhere" }}>{m.name}</strong>
            {m.dose || m.frequency ? <span className="small">{[m.dose, m.frequency].filter(Boolean).join(" · ")}</span> : null}
          </span>
          <RowActions label={t("rowLabel", { name: m.name })} onEdit={() => openEdit(m)} onDelete={() => setToDelete(m)} />
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {on ? <span className="due due--ok"><IconCheck size={14} /> {t("inUse")}</span> : null}
          <span className="caption">
            {m.startDate > today ? t("startsOn", { date: date(m.startDate) }) : t("since", { date: date(m.startDate) })}
            {" · "}{m.endDate ? (m.endDate < today ? t("ended", { date: date(m.endDate) }) : t("until", { date: date(m.endDate) })) : t("noEnd")}
          </span>
        </div>
        {m.repeat ? (() => {
          const due = medNextDue(m);
          return (
            <div className="med-due">
              <span>🔔 {tc(`repeat.${m.repeat}`)} · {due ? <>{t.rich("nextDose", { date: date(due), strong: (c) => <strong>{c}</strong> })}{due < today ? ` ${t("late")}` : due === today ? ` ${t("today")}` : ""}</> : t("finished")}{m.lastGiven ? ` · ${t("last", { date: date(m.lastGiven) })}` : ""}</span>
              {due && due <= today ? <button type="button" className="btn btn--secondary btn--small" onClick={() => markGiven(m)}>{t("givenToday")}</button> : null}
              {due ? <a className="btn btn--ghost btn--small" href={`/api/calendario?tipo=medicamento&id=${m.id}`}>{t("reminder")}</a> : null}
            </div>
          );
        })() : null}
        {m.notes ? <p className="small" style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{m.notes}</p> : null}
      </li>
    );
  };

  return (
    <>
      <TopBar title={t("title")} back="/cuidados" emoji="💊" />
      <main className="main">
        <button type="button" className="btn btn--primary btn--block" onClick={openNew}><IconPlus /> {t("add")}</button>
        <p className="page-note">{t("note")}</p>
        {meds.length === 0 ? <p className="muted">{t("empty")}</p> : null}
        {active.length ? (
          <section className="stack" aria-labelledby="em-uso">
            <h2 id="em-uso">{t("inUse")}</h2>
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>{active.map(row)}</ul>
          </section>
        ) : null}
        {others.length ? (
          <section className="stack" aria-labelledby="outros">
            <h2 id="outros">{t("others")}</h2>
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>{others.map(row)}</ul>
          </section>
        ) : null}
      </main>

      <FormSheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t("editTitle") : t("newTitle")} onSubmit={submit} busy={busy} error={error}>
        {editing ? (
          <>
            <Field id="mname" label={t("name")} value={editing.form.name} onChange={(v) => set({ name: v })} maxLength={80} />
            <Field id="mdose" label={t("dose")} optional value={editing.form.dose} onChange={(v) => set({ dose: v })} maxLength={80} placeholder={t("dosePlaceholder")} />
            <div className="field">
              <label htmlFor="mrepeat">{t("repeat")}</label>
              <select id="mrepeat" className="select" value={editing.form.repeat} onChange={(e) => set({ repeat: e.target.value as MedRepeat })}>
                {MED_REPEAT.map((k) => <option key={k} value={k}>{tc(`repeat.${k || "none"}`)}</option>)}
              </select>
              <span className="caption">{t("repeatHint")}</span>
            </div>
            <Field id="mfreq" label={t("how")} optional value={editing.form.frequency} onChange={(v) => set({ frequency: v })} maxLength={80} placeholder={t("howPlaceholder")} />
            <Field id="mstart" label={t("start")} type="date" value={editing.form.startDate} onChange={(v) => set({ startDate: v })} />
            <Field id="mend" label={t("end")} optional type="date" value={editing.form.endDate} onChange={(v) => set({ endDate: v })} hint={t("endHint")} />
            <Field id="mnotes" label={t("notes")} optional multiline value={editing.form.notes} onChange={(v) => set({ notes: v })} maxLength={500} />
          </>
        ) : null}
      </FormSheet>
      <DeleteSheet open={!!toDelete} onClose={() => setToDelete(null)} title={t("deleteTitle")} text={toDelete ? `${toDelete.name}.` : ""} busy={busy}
        onConfirm={async () => { if (toDelete && (await run(() => repo!.deleteHealthRecord("medications", toDelete.id), removeCare("medications", toDelete.id)))) setToDelete(null); }} />
    </>
  );
}
