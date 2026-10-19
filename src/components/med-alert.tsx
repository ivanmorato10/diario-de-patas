"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useStore } from "@/data/store";
import { Sheet } from "@/components/entry-actions";
import { useFormat } from "@/i18n/use-format";
import { medsDue, type Medication } from "@/domain/health";

const key = (today: string) => `ddp-med-alert:${today}`;

/** Janela "Hora do remédio" ao abrir o app no dia da dose (uma vez por dia; "Lembrar mais tarde" adia para amanhã). */
export function MedAlert({ meds, today, dogName }: { meds: Medication[]; today: string; dogName: string }) {
  const { repo, reload } = useStore();
  const due = medsDue(meds, today);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const t = useTranslations("medAlert");
  const f = useFormat();

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(key(today)) === "1"; } catch { /* sem armazenamento: mostra */ }
    if (due.length && !seen) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due.length, today]);

  const later = () => {
    try { localStorage.setItem(key(today), "1"); } catch { /* ok */ }
    setOpen(false);
  };
  async function given(m: Medication) {
    setBusy(m.id);
    try {
      await repo!.saveMedication({ ...m, lastGiven: today }, m.id);
      await reload();
    } finally {
      setBusy(null);
    }
  }
  if (!due.length) return null;
  return (
    <Sheet open={open} onClose={later} labelledBy="med-title">
      <h2 id="med-title">{t("title", { dog: dogName })}</h2>
      <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {due.map(({ m, due: d }) => (
          <li key={m.id} className="card stack" style={{ padding: 12, gap: 6 }}>
            <strong>{m.name}</strong>
            <span className="small">{[m.dose, m.frequency].filter(Boolean).join(" · ") || t("asVetSaid")}</span>
            <span className="caption">{d < today ? t("lateSince", { date: f.date(d) }) : t("today")}</span>
            <button type="button" className="btn btn--primary btn--small" disabled={busy === m.id} onClick={() => given(m)}>{busy === m.id ? t("saving") : t("given")}</button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn--ghost btn--block" onClick={later}>{t("later")}</button>
    </Sheet>
  );
}
