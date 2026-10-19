"use client";

import { mapsUrl } from "@/lib/maps";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { useStore } from "@/data/store";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { HealthDisclaimer } from "@/components/health-ui";
import { DeleteSheet, Field, FormSheet, RowActions, useCareMutation } from "@/components/care-forms";
import { IconPhone, IconPin, IconPlus } from "@/components/icons";
import { CONTACT_KINDS, type Contact, type ContactKind } from "@/domain/health";

interface Form { kind: ContactKind; name: string; phone: string; address: string; notes: string }

/** Link de busca no mapa — o app não coleta localização. */
const mapHref = (address: string) => mapsUrl(address);
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export default function Contatos() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo } = useStore();
  const { busy, error, setError, run } = useCareMutation();
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [toDelete, setToDelete] = useState<Contact | null>(null);
  const t = useTranslations("contactsPage");
  const tc = useTranslations("care");

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !repo) return <main className="main"><PageLoading /></main>;
  const contacts = snap.health.contacts;

  const openNew = () => { setError(null); setEditing({ form: { kind: "vet", name: "", phone: "", address: "", notes: "" } }); };
  const openEdit = (c: Contact) => { setError(null); setEditing({ id: c.id, form: { kind: c.kind, name: c.name, phone: c.phone, address: c.address, notes: c.notes } }); };
  const set = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  const submit = async () => { if (editing && (await run(() => repo!.saveContact(editing.form, editing.id)))) setEditing(null); };

  return (
    <>
      <TopBar title={t("title")} back="/cuidados" emoji="📞" />
      <main className="main">
        <button type="button" className="btn btn--primary btn--block" onClick={openNew}><IconPlus /> {t("add")}</button>
        <a className="btn btn--secondary btn--block" href={mapsUrl(t("vetSearch"), t("nearMe"))} target="_blank" rel="noopener">{t("findVet")}</a>
        {contacts.length === 0 ? <p className="page-note">{t("empty")}</p> : null}
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {contacts.map((c) => (
            <li key={c.id} className="card stack" style={{ padding: 14, gap: 8 }}>
              <div className="row-between" style={{ alignItems: "flex-start" }}>
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <span className="caption">{tc(`contactKinds.${c.kind}`)}</span>
                  <strong style={{ overflowWrap: "anywhere" }}>{c.name}</strong>
                  {c.phone ? <span className="small">{c.phone}</span> : null}
                  {c.address ? <span className="small" style={{ overflowWrap: "anywhere" }}>{c.address}</span> : null}
                </span>
                <RowActions label={t("rowLabel", { name: c.name })} onEdit={() => openEdit(c)} onDelete={() => setToDelete(c)} />
              </div>
              {c.notes ? <p className="small" style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{c.notes}</p> : null}
              {c.phone || c.address ? (
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  {c.phone ? <a href={telHref(c.phone)} className="btn btn--secondary btn--small" aria-label={t("callLabel", { name: c.name })}><IconPhone size={18} /> {t("call")}</a> : null}
                  {c.address ? <a href={mapHref(c.address)} target="_blank" rel="noopener noreferrer" className="btn btn--secondary btn--small" aria-label={t("mapLabel", { name: c.name })}><IconPin size={18} /> {t("map")}</a> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <HealthDisclaimer />
      </main>

      <FormSheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t("editTitle") : t("newTitle")} onSubmit={submit} busy={busy} error={error}>
        {editing ? (
          <>
            <div className="field">
              <label htmlFor="ckind">{t("type")}</label>
              <select id="ckind" className="input" value={editing.form.kind} onChange={(e) => set({ kind: e.target.value as ContactKind })}>
                {CONTACT_KINDS.map((k) => <option key={k} value={k}>{tc(`contactKinds.${k}`)}</option>)}
              </select>
            </div>
            <Field id="kname" label={t("name")} value={editing.form.name} onChange={(v) => set({ name: v })} maxLength={80} />
            <Field id="kphone" label={t("phone")} optional type="tel" inputMode="tel" value={editing.form.phone} onChange={(v) => set({ phone: v })} maxLength={30} />
            <Field id="kaddr" label={t("address")} optional value={editing.form.address} onChange={(v) => set({ address: v })} maxLength={200} />
            <Field id="knotes" label={t("notes")} optional multiline value={editing.form.notes} onChange={(v) => set({ notes: v })} maxLength={500} />
          </>
        ) : null}
      </FormSheet>
      <DeleteSheet open={!!toDelete} onClose={() => setToDelete(null)} title={t("deleteTitle")} text={toDelete ? `${toDelete.name}.` : ""} busy={busy}
        onConfirm={async () => { if (toDelete && (await run(() => repo!.deleteHealthRecord("contacts", toDelete.id)))) setToDelete(null); }} />
    </>
  );
}
