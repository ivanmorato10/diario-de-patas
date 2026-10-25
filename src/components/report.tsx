"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { rpc } from "@/data/real-repository";
import { DomainError } from "@/data/demo-repository";
import { useStore } from "@/data/store";
import { useErrorText } from "@/i18n/use-error";
import { Sheet } from "@/components/entry-actions";
import { SUPPORT } from "@/config/business";
import type { Snapshot } from "@/data/demo-repository";

export const REPORT_REASONS = ["inappropriate", "harassment", "spam", "other"] as const;
type Reason = (typeof REPORT_REASONS)[number];
export interface ReportTarget { type: "entry" | "letter" | "user"; id: string; authorId?: string | null; authorName?: string | null }

/** Tira da tela o que a pessoa bloqueada publicou (o servidor também filtra a partir de agora). */
export const withBlocked = (userId: string, on: boolean) => (s: Snapshot): Snapshot => {
  const blocked = new Set(s.me?.blocked ?? []);
  if (on) blocked.add(userId); else blocked.delete(userId);
  return {
    ...s,
    me: s.me ? { ...s.me, blocked: [...blocked] } : s.me,
    entries: on ? s.entries.filter((e) => e.createdBy !== userId) : s.entries,
    letters: on && s.letters ? s.letters.filter((l) => l.createdBy !== userId) : s.letters,
  };
};

/**
 * Denunciar foto, cartinha ou pessoa (App Store 1.2): motivo, detalhes e, se quiser, bloquear quem publicou.
 * A denúncia vai para o suporte, que responde em até 24 horas.
 */
export function ReportSheet({ open, onClose, target }: { open: boolean; onClose: () => void; target: ReportTarget }) {
  const t = useTranslations("report");
  const errText = useErrorText();
  const { snap, patchSnap } = useStore();
  const titleId = useId();
  const [reason, setReason] = useState<Reason>("inappropriate");
  const [details, setDetails] = useState("");
  const [block, setBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blocked: boolean } | null>(null);
  const canBlock = !!target.authorId && target.authorId !== snap?.me?.userId;

  function close() {
    setDone(null); setError(null); setDetails(""); setBlock(false); setReason("inappropriate");
    onClose();
  }
  async function send() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await rpc<{ blocked: boolean }>("reportContent", { targetType: target.type, targetId: target.id, reason, details, block: canBlock && block });
      if (r.blocked && target.authorId) patchSnap(withBlocked(target.authorId, true));
      setDone({ blocked: r.blocked });
    } catch (e) {
      setError(errText(e instanceof DomainError ? e : null, "report.failed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onClose={close} labelledBy={titleId}>
      <h2 id={titleId}>{t(`title.${target.type}`)}</h2>
      {done ? (
        <>
          <p className="small" role="status">{t("thanks", { email: SUPPORT.email })}</p>
          {done.blocked ? <p className="small">{t("blockedToo", { name: target.authorName || t("thisPerson") })}</p> : null}
          <button type="button" className="btn btn--secondary btn--block" onClick={close}>{t("close")}</button>
        </>
      ) : (
        <>
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 6 }}>
            <legend className="small">{t("why")}</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r} className="check"><input type="radio" name={`${titleId}-reason`} checked={reason === r} onChange={() => setReason(r)} /><span>{t(`reasons.${r}`)}</span></label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor={`${titleId}-d`}>{t("details")}</label>
            <textarea id={`${titleId}-d`} className="textarea" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} />
          </div>
          {canBlock ? (
            <label className="check"><input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} /><span>{t("alsoBlock", { name: target.authorName || t("thisPerson") })}</span></label>
          ) : null}
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button type="button" className="btn btn--primary btn--block" onClick={send} disabled={busy}>{busy ? t("sending") : t("send")}</button>
          <button type="button" className="btn btn--ghost btn--block" onClick={close} disabled={busy}>{t("cancel")}</button>
        </>
      )}
    </Sheet>
  );
}

/** Bloquear/desbloquear alguém do diário (sem denunciar). */
export function useBlock() {
  const { patchSnap, reload } = useStore();
  return async (userId: string, on: boolean) => {
    await rpc("blockUser", { userId, blocked: on });
    patchSnap(withBlocked(userId, on));
    if (!on) void reload().catch(() => undefined); // desbloqueou: as fotos e cartinhas da pessoa voltam
  };
}
