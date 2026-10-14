"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REAL_MODE } from "@/config/mode";
import { useStore } from "@/data/store";

/**
 * Depois da primeira lembrança, o Abu sugere chamar a família (sem obrigar nada).
 * Só para quem administra o diário e ainda está sozinho nele; "Agora não" esconde neste aparelho.
 */
export function FamilyNudge() {
  const { snap } = useStore();
  const dog = snap?.dog;
  const key = `ddp-family-nudge-${dog?.id ?? ""}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { setHidden(localStorage.getItem(key) === "no"); } catch { setHidden(false); }
  }, [key]);

  const alone = (snap?.members?.length ?? 1) <= 1;
  if (!REAL_MODE || !dog || hidden || snap?.role !== "admin" || !alone || !snap.entries.length) return null;

  function dismiss() {
    setHidden(true);
    try { localStorage.setItem(key, "no"); } catch { /* ok */ }
  }

  return (
    <section className="page-note family-nudge" aria-label="Convidar a família">
      <p style={{ margin: 0 }}>Quem também faz parte das aventuras de {dog.name}? Convide alguém para guardar momentos com você.</p>
      <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Link href="/config#familia" className="btn btn--secondary btn--small">Convidar alguém</Link>
        <button type="button" className="btn btn--ghost btn--small" onClick={dismiss}>Agora não</button>
      </div>
    </section>
  );
}
