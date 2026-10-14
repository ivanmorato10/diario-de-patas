"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/data/store";
import { Sheet } from "@/components/entry-actions";
import { formatCivilDate } from "@/domain/dates";
import { medsDue, type Medication } from "@/domain/health";

const key = (today: string) => `ddp-med-alert:${today}`;

/** Janela "Hora do remédio" ao abrir o app no dia da dose (uma vez por dia; "Lembrar mais tarde" adia para amanhã). */
export function MedAlert({ meds, today, dogName }: { meds: Medication[]; today: string; dogName: string }) {
  const { repo, reload } = useStore();
  const due = medsDue(meds, today);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

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
      <h2 id="med-title">💊 Hora do remédio de {dogName}</h2>
      <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {due.map(({ m, due: d }) => (
          <li key={m.id} className="card stack" style={{ padding: 12, gap: 6 }}>
            <strong>{m.name}</strong>
            <span className="small">{[m.dose, m.frequency].filter(Boolean).join(" · ") || "Conforme a orientação do veterinário"}</span>
            <span className="caption">{d < today ? `Atrasada desde ${formatCivilDate(d)}` : "Dose de hoje"}</span>
            <button type="button" className="btn btn--primary btn--small" disabled={busy === m.id} onClick={() => given(m)}>{busy === m.id ? "Salvando…" : "Já dei"}</button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn--ghost btn--block" onClick={later}>Lembrar mais tarde</button>
    </Sheet>
  );
}
