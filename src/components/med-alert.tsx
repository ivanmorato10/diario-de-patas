"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useStore } from "@/data/store";
import { Sheet } from "@/components/entry-actions";
import { upsertCare } from "@/components/care-forms";
import { useFormat } from "@/i18n/use-format";
import { medsDue, type Medication } from "@/domain/health";

/** "Lembrar amanhã" vale para ESTA pessoa e ESTE cachorro neste dia (adiar o Abu não silencia o Pepe nem outra conta). */
export const medAlertKey = (userId: string, dogId: string, today: string) => `ddp-med-alert:${userId}:${dogId}:${today}`;

/** Janela "Hora do remédio" ao abrir o app no dia da dose (uma vez por dia por cachorro; "Lembrar amanhã" adia para amanhã). */
export function MedAlert({ meds, today, dogName }: { meds: Medication[]; today: string; dogName: string }) {
  const { snap, repo, reload, patchDog } = useStore();
  const due = medsDue(meds, today);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null); // dose que não deu para marcar
  const userId = snap?.me?.userId ?? "";
  const dogId = snap?.dog?.id ?? "";
  const t = useTranslations("medAlert");
  const f = useFormat();

  // Recalcula ao trocar de cachorro ou de conta (mesmo com a mesma quantidade de doses pendentes).
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(medAlertKey(userId, dogId, today)) === "1"; } catch { /* sem armazenamento: mostra */ }
    setOpen(!!(due.length && dogId && !seen && snap?.role !== "viewer")); // quem só vê não marca dose
    setFailed(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due.length, today, dogId, userId, snap?.role]);

  const later = () => {
    try { localStorage.setItem(medAlertKey(userId, dogId, today), "1"); } catch { /* ok */ }
    setOpen(false);
  };
  async function given(m: Medication) {
    if (busy) return;
    setBusy(m.id);
    setFailed(null);
    const dogAtStart = snap?.dog?.id;
    try {
      const saved = await repo!.saveMedication({ ...m, lastGiven: today }, m.id);
      patchDog(dogAtStart, (s) => upsertCare("medications")(s, saved));
      void reload().catch(() => undefined);
    } catch {
      setFailed(m.id); // não marca a dose como dada se não gravou
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
            <button type="button" className="btn btn--primary btn--small" disabled={!!busy} onClick={() => given(m)} aria-busy={busy === m.id ? "true" : undefined}>{busy === m.id ? t("saving") : t("given")}</button>
            {failed === m.id ? <span className="field-error" role="alert">{t("failed")}</span> : null}
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn--ghost btn--block" onClick={later}>{t("later")}</button>
    </Sheet>
  );
}
