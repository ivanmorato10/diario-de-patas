"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/i18n/use-error";
import { DomainError } from "@/data/demo-repository";
import { useStore } from "@/data/store";
import type { Snapshot } from "@/data/demo-repository";
import { Sheet } from "./entry-actions";
import { IconPencil, IconTrash } from "./icons";

/** Salvar/excluir um registro da ficha com estado de erro e recarga do snapshot. */

type CareList = "weights" | "vaccines" | "visits" | "medications" | "contacts" | "documents";

/** Põe (ou troca) na lista de cuidados o registro que o servidor devolveu. */
export const upsertCare = (store: CareList) => (s: Snapshot, rec: unknown): Snapshot => {
  if (!rec || typeof rec !== "object" || !("id" in rec)) return s;
  const r = rec as { id: string };
  const list = s.health[store] as { id: string }[];
  let next = list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : store === "weights" ? [...list, r] : [r, ...list];
  if (store === "weights") next = [...next].sort((a, b) => String((a as { date?: string }).date).localeCompare(String((b as { date?: string }).date)));
  return { ...s, health: { ...s.health, [store]: next } };
};

/** Tira da lista de cuidados o registro excluído. */
export const removeCare = (store: CareList, id: string) => (s: Snapshot): Snapshot =>
  ({ ...s, health: { ...s.health, [store]: (s.health[store] as { id: string }[]).filter((x) => x.id !== id) } });

export function useCareMutation() {
  const { snap, reload, patchDog } = useStore();
  const dogNow = useRef<string | undefined>(undefined);
  dogNow.current = snap?.dog?.id; // cachorro aberto agora (lido no começo de cada operação)
  const [busy, setBusy] = useState(false);
  const [errorRaw, setError] = useState<string | null>(null);
  const errText = useErrorText();
  const error = errorRaw ? errText(errorRaw) : null;
  /**
   * Gravar e atualizar a tela são coisas separadas: o sucesso aparece assim que o servidor grava; a atualização da
   * tela vem em seguida e, se falhar, não vira "não salvou" (a próxima abertura atualiza). Repetir uma criação não
   * duplica (chave de repetição em real-repository).
   */
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, apply?: (s: Snapshot, saved: T) => Snapshot): Promise<boolean> => {
      setBusy(true);
      setError(null);
      const dogAtStart = dogNow.current; // a resposta só entra se o diário aberto ainda for este
      let saved: T;
      try {
        saved = await fn();
      } catch (e) {
        setError(e instanceof DomainError ? e.message : "errors.saveFailed");
        setBusy(false);
        return false;
      }
      // O que o servidor devolveu entra na tela já; o recarregamento depois só confere.
      if (apply) patchDog(dogAtStart, (s) => apply(s, saved));
      setBusy(false);
      void reload().catch(() => undefined);
      return true;
    },
    [reload, patchDog],
  );
  return { busy, error, setError, run };
}

/** Janela de criar/editar um registro. */
export function FormSheet({
  open, onClose, title, onSubmit, busy, error, submitLabel, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const t = useTranslations("forms");
  return (
    <Sheet open={open} onClose={onClose} labelledBy={id}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
        <h2 id={id}>{title}</h2>
        {children}
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="stack">
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{busy ? t("saving") : submitLabel ?? t("save")}</button>
          <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>{t("cancel")}</button>
        </div>
      </form>
    </Sheet>
  );
}

/** Confirmação de exclusão. */
export function DeleteSheet({ open, onClose, title, text, onConfirm, busy }: { open: boolean; onClose: () => void; title: string; text: string; onConfirm: () => void; busy: boolean }) {
  const id = useId();
  const t = useTranslations("forms");
  return (
    <Sheet open={open} onClose={onClose} labelledBy={id}>
      <h2 id={id}>{title}</h2>
      <p>{text} {t("noUndo")}</p>
      <div className="stack">
        <button type="button" className="btn btn--danger btn--block" onClick={onConfirm} disabled={busy}>{t("delete")}</button>
        <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>{t("cancel")}</button>
      </div>
    </Sheet>
  );
}

/** Botões editar/excluir de uma linha. */
export function RowActions({ label, onEdit, onDelete }: { label: string; onEdit?: () => void; onDelete: () => void }) {
  const t = useTranslations("forms");
  return (
    <div className="row" style={{ gap: 0, flex: "none" }}>
      {onEdit ? <button type="button" className="icon-btn" onClick={onEdit} aria-label={t("editLabel", { label })}><IconPencil /></button> : null}
      <button type="button" className="icon-btn" onClick={onDelete} aria-label={t("deleteLabel", { label })} style={{ color: "var(--danger)" }}><IconTrash /></button>
    </div>
  );
}

/** Campo de texto/data com rótulo. */
export function Field({
  id, label, optional, value, onChange, type = "text", max, maxLength, inputMode, placeholder, multiline, hint,
}: {
  id: string;
  label: string;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "date" | "tel" | "number" | "time";
  max?: string;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
}) {
  const t = useTranslations("forms");
  return (
    <div className="field">
      <label htmlFor={id}>{label} {optional ? <span className="muted">{t("optional")}</span> : null}</label>
      {multiline ? (
        <textarea id={id} className="textarea" value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input id={id} className="input" type={type} value={value} max={max} maxLength={maxLength} inputMode={inputMode} step={type === "number" ? "0.1" : undefined} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
