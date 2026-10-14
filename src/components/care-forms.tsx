"use client";

import { useCallback, useId, useState } from "react";
import { DomainError } from "@/data/demo-repository";
import { useStore } from "@/data/store";
import { Sheet } from "./entry-actions";
import { IconPencil, IconTrash } from "./icons";

/** Salvar/excluir um registro da ficha com estado de erro e recarga do snapshot. */
export function useCareMutation() {
  const { reload } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (fn: () => Promise<unknown>): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        await reload();
        return true;
      } catch (e) {
        setError(e instanceof DomainError ? e.message : "Não conseguimos salvar. Tente novamente.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );
  return { busy, error, setError, run };
}

/** Janela de criar/editar um registro. */
export function FormSheet({
  open, onClose, title, onSubmit, busy, error, submitLabel = "Salvar", children,
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
  return (
    <Sheet open={open} onClose={onClose} labelledBy={id}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
        <h2 id={id}>{title}</h2>
        {children}
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="stack">
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{busy ? "Salvando…" : submitLabel}</button>
          <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </Sheet>
  );
}

/** Confirmação de exclusão. */
export function DeleteSheet({ open, onClose, title, text, onConfirm, busy }: { open: boolean; onClose: () => void; title: string; text: string; onConfirm: () => void; busy: boolean }) {
  const id = useId();
  return (
    <Sheet open={open} onClose={onClose} labelledBy={id}>
      <h2 id={id}>{title}</h2>
      <p>{text} Não dá para desfazer.</p>
      <div className="stack">
        <button type="button" className="btn btn--danger btn--block" onClick={onConfirm} disabled={busy}>Excluir</button>
        <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>Cancelar</button>
      </div>
    </Sheet>
  );
}

/** Botões editar/excluir de uma linha. */
export function RowActions({ label, onEdit, onDelete }: { label: string; onEdit?: () => void; onDelete: () => void }) {
  return (
    <div className="row" style={{ gap: 0, flex: "none" }}>
      {onEdit ? <button type="button" className="icon-btn" onClick={onEdit} aria-label={`Editar ${label}`}><IconPencil /></button> : null}
      <button type="button" className="icon-btn" onClick={onDelete} aria-label={`Excluir ${label}`} style={{ color: "var(--danger)" }}><IconTrash /></button>
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
  return (
    <div className="field">
      <label htmlFor={id}>{label} {optional ? <span className="muted">(opcional)</span> : null}</label>
      {multiline ? (
        <textarea id={id} className="textarea" value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input id={id} className="input" type={type} value={value} max={max} maxLength={maxLength} inputMode={inputMode} step={type === "number" ? "0.1" : undefined} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
