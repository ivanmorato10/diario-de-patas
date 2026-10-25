"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const REASONS = ["inappropriate", "harassment", "spam", "other"] as const;

/** Álbum público: qualquer pessoa com o link pode denunciar (sem conta). Vai para o suporte, que responde em até 24 h. */
export function ShareReport({ token }: { token: string }) {
  const t = useTranslations("report");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("inappropriate");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  async function send() {
    setState("sending");
    const res = await fetch("/api/denuncia", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, reason, details }) }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }
  if (state === "done") return <p className="small" role="status" style={{ textAlign: "center" }}>{t("publicThanks")}</p>;
  if (!open) return <p style={{ textAlign: "center" }}><button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(true)}>{t("reportAlbum")}</button></p>;
  return (
    <section className="card stack" aria-labelledby="share-report-title" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h2 id="share-report-title" style={{ margin: 0 }}>{t("title.share")}</h2>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 6 }}>
        <legend className="small">{t("why")}</legend>
        {REASONS.map((r) => (
          <label key={r} className="check"><input type="radio" name="share-reason" checked={reason === r} onChange={() => setReason(r)} /><span>{t(`reasons.${r}`)}</span></label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="share-report-d">{t("details")}</label>
        <textarea id="share-report-d" className="textarea" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} />
      </div>
      {state === "error" ? <p className="field-error" role="alert">{t("failed")}</p> : null}
      <button type="button" className="btn btn--primary btn--block" onClick={send} disabled={state === "sending"}>{state === "sending" ? t("sending") : t("send")}</button>
      <button type="button" className="btn btn--ghost btn--block" onClick={() => setOpen(false)} disabled={state === "sending"}>{t("cancel")}</button>
    </section>
  );
}
