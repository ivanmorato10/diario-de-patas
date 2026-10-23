"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { Field, useCareMutation } from "@/components/care-forms";
import type { Snapshot } from "@/data/demo-repository";
import { useStore } from "@/data/store";
import type { HealthProfileData } from "@/domain/health";

const EMPTY: HealthProfileData = { breed: "", sex: null, neutered: null, microchip: "", coat: "", allergies: "", notes: "" };

export default function DadosDoCachorro() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo } = useStore();
  const { busy, error, run } = useCareMutation();
  const [form, setForm] = useState<HealthProfileData | null>(null);
  const [saved, setSaved] = useState(false);
  const t = useTranslations("dogInfo");

  useEffect(() => {
    if (snap && form === null) {
      const p = snap.health.profile;
      setForm(p ? { breed: p.breed, sex: p.sex, neutered: p.neutered, microchip: p.microchip, coat: p.coat, allergies: p.allergies, notes: p.notes } : EMPTY);
    }
  }, [snap, form]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !form || !repo) return <main className="main"><PageLoading /></main>;
  const set = (patch: Partial<HealthProfileData>) => { setSaved(false); setForm({ ...form, ...patch }); };

  return (
    <>
      <TopBar title={t("title", { dog: snap.dog.name })} back="/cuidados" />
      <main className="main">
        
        <form className="stack-lg" onSubmit={async (e) => { e.preventDefault(); setSaved(await run(() => repo!.saveHealthProfile(form), (s, p) => (p && typeof p === "object" ? { ...s, health: { ...s.health, profile: p as Snapshot["health"]["profile"] } } : s))); }} noValidate>
          <Field id="breed" label={t("breed")} optional value={form.breed} onChange={(v) => set({ breed: v })} maxLength={60} placeholder={t("breedPlaceholder")} />
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>{t("sex")} <span className="muted">{t("optional")}</span></legend>
            <div className="row" style={{ flexWrap: "wrap" }}>
              {([["female", t("female")], ["male", t("male")], [null, t("notSay")]] as const).map(([v, l]) => (
                <label key={l} className="check"><input type="radio" name="sex" checked={form.sex === v} onChange={() => set({ sex: v })} /><span>{l}</span></label>
              ))}
            </div>
          </fieldset>
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>{t("neutered")} <span className="muted">{t("optional")}</span></legend>
            <div className="row" style={{ flexWrap: "wrap" }}>
              {([[true, t("yes")], [false, t("no")], [null, t("notSay")]] as const).map(([v, l]) => (
                <label key={l} className="check"><input type="radio" name="neutered" checked={form.neutered === v} onChange={() => set({ neutered: v })} /><span>{l}</span></label>
              ))}
            </div>
          </fieldset>
          <Field id="chip" label={t("microchip")} optional value={form.microchip} onChange={(v) => set({ microchip: v })} maxLength={40} inputMode="numeric" />
          <Field id="coat" label={t("coat")} optional value={form.coat} onChange={(v) => set({ coat: v })} maxLength={60} />
          <Field id="allergies" label={t("allergies")} optional multiline value={form.allergies} onChange={(v) => set({ allergies: v })} maxLength={500} />
          <Field id="notes" label={t("notes")} optional multiline value={form.notes} onChange={(v) => set({ notes: v })} maxLength={1000} />
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          {saved ? <p className="notice notice--positive" role="status">{t("saved")}</p> : null}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{busy ? t("saving") : t("save")}</button>
        </form>
      </main>
    </>
  );
}
