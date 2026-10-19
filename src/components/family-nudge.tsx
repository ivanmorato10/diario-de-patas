"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useStore } from "@/data/store";
import { Sheet } from "./entry-actions";
import { InviteBox } from "./invite-box";

/**
 * Depois da primeira lembrança, o Abu sugere chamar a família (sem obrigar nada).
 * Só para quem administra o diário e ainda está sozinho nele; "Agora não" esconde neste aparelho.
 */
export function FamilyNudge() {
  const { snap } = useStore();
  const dog = snap?.dog;
  const key = `ddp-family-nudge-${dog?.id ?? ""}`;
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const t = useTranslations("familyNudge");
  useEffect(() => {
    try { setHidden(localStorage.getItem(key) === "no"); } catch { setHidden(false); }
  }, [key]);

  const alone = (snap?.members?.length ?? 1) <= 1;
  if (!dog || hidden || snap?.role !== "admin" || !alone || !snap.entries.length) return null;

  function dismiss() {
    setHidden(true);
    try { localStorage.setItem(key, "no"); } catch { /* ok */ }
  }

  return (
    <>
    <section className="page-note family-nudge" aria-label={t("label")}>
      <p style={{ margin: 0 }}>{t("text", { dog: dog.name })}</p>
      <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn btn--secondary btn--small" onClick={() => setOpen(true)}>{t("invite")}</button>
        <button type="button" className="btn btn--secondary btn--small" onClick={dismiss}>{t("notNow")}</button>
      </div>
    </section>
      {/* Fora do bilhete: o popup não herda a letra de caderno. */}
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="nudge-invite-title">
        <h2 id="nudge-invite-title">{t("sheetTitle", { dog: dog.name })}</h2>
        <p className="caption">{t("sheetText")}</p>
        <InviteBox dogName={dog.name} />
        <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={() => setOpen(false)}>{t("close")}</button>
      </Sheet>
    </>
  );
}
