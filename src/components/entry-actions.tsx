"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { COLLECTIONS, MISSIONS, type CollectionId } from "@/config/catalog";
import { LIMITS } from "@/config/business";
import { useStore } from "@/data/store";
import { deleteEntry, getMedia, updateEntry, DomainError } from "@/data/demo-repository";
import { isCivilDate } from "@/domain/dates";
import { missionState } from "@/domain/missions";
import type { DiaryEntry } from "@/domain/types";
import { IconChevron, IconDownload, IconPencil, IconStar, IconTrash } from "./icons";
import { collectionTitle } from "./mission-ui";

export function Sheet({ open, onClose, labelledBy, children }: { open: boolean; onClose: () => void; labelledBy: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-labelledby={labelledBy} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="sheet__body">{children}</div>
    </dialog>
  );
}

export function EntryActions({ entry, albumIds, today, label }: { entry: DiaryEntry; albumIds: CollectionId[]; today: string; label: string }) {
  const { db, reload } = useStore();
  const [mode, setMode] = useState<"none" | "edit" | "delete">("none");
  const [caption, setCaption] = useState(entry.caption);
  const [date, setDate] = useState(entry.occurredDate);
  const [albums, setAlbums] = useState<CollectionId[]>(albumIds);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openEdit() {
    setCaption(entry.caption);
    setDate(entry.occurredDate);
    setAlbums(albumIds);
    setError(null);
    setMode("edit");
  }

  async function saveEdit() {
    if (!db) return;
    if (!isCivilDate(date) || date > today) return setError("Escolha uma data até hoje.");
    setBusy(true);
    try {
      await updateEntry(db, entry.id, { caption, occurredDate: date, albumIds: albums });
      await reload();
      setMode("none");
    } catch (e) {
      setError(e instanceof DomainError ? e.message : "Não conseguimos salvar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!db) return;
    setBusy(true);
    try {
      await deleteEntry(db, entry.id);
      setMode("none");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!db) return;
    const m = await getMedia(db, entry.mediaId);
    if (!m) return;
    const url = URL.createObjectURL(m.display);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diario-de-patas-${entry.occurredDate}.${m.mime === "image/webp" ? "webp" : "jpg"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const editTitle = `edit-${entry.id}`;
  const delTitle = `del-${entry.id}`;
  return (
    <>
      <div className="row" style={{ gap: 0 }}>
        <button type="button" className="icon-btn" onClick={openEdit} aria-label={`Editar ${label}`}><IconPencil /></button>
        <button type="button" className="icon-btn" onClick={download} aria-label={`Baixar ${label}`}><IconDownload /></button>
        <button type="button" className="icon-btn" onClick={() => setMode("delete")} aria-label={`Excluir ${label}`} style={{ color: "var(--danger)" }}><IconTrash /></button>
      </div>

      <Sheet open={mode === "edit"} onClose={() => setMode("none")} labelledBy={editTitle}>
        <h2 id={editTitle}>Editar lembrança</h2>
        <div className="field">
          <label htmlFor={`cap-${entry.id}`}>Legenda</label>
          <textarea id={`cap-${entry.id}`} className="textarea" value={caption} maxLength={LIMITS.captionMaxChars} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`date-${entry.id}`}>Quando aconteceu</label>
          <input id={`date-${entry.id}`} type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 8 }}>Álbuns</legend>
          {COLLECTIONS.map((c) => (
            <label key={c.id} className="check">
              <input type="checkbox" checked={albums.includes(c.id)} onChange={(e) => setAlbums((a) => (e.target.checked ? [...a, c.id] : a.filter((x) => x !== c.id)))} />
              <span>{c.title}</span>
            </label>
          ))}
        </fieldset>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="stack">
          <button type="button" className="btn btn--primary btn--block" onClick={saveEdit} disabled={busy}>Salvar</button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setMode("none")}>Cancelar</button>
        </div>
      </Sheet>

      <Sheet open={mode === "delete"} onClose={() => setMode("none")} labelledBy={delTitle}>
        <h2 id={delTitle}>Excluir esta lembrança?</h2>
        <p>A foto sai do diário e dos álbuns. {entry.missionId ? "A conquista e os pontos da missão continuam." : ""} Não dá para desfazer.</p>
        <div className="stack">
          <button type="button" className="btn btn--danger btn--block" onClick={confirmDelete} disabled={busy}>Excluir</button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setMode("none")}>Cancelar</button>
        </div>
      </Sheet>
    </>
  );
}

/**
 * “Usar numa missão” (MUDANCAS-V2 §2): leva uma foto livre do diário direto à confirmação de uma missão,
 * sem novo envio. Só aparece para fotos livres — artes não concluem missão e uma foto pontua uma vez.
 */
export function UseInMission({ entry, completed, label }: { entry: DiaryEntry; completed: ReadonlySet<string>; label: string }) {
  const [open, setOpen] = useState(false);
  if (entry.source !== "free" || entry.missionId) return null;
  const options = MISSIONS.map((m) => ({ m, state: missionState(m, completed) }))
    .filter((o) => o.state !== "locked")
    .sort((a, b) => Number(a.state === "completed") - Number(b.state === "completed"));
  const title = `use-${entry.id}`;
  return (
    <>
      <button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(true)} aria-label={`Usar ${label} numa missão`}>
        <IconStar size={18} /> Usar numa missão
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy={title}>
        <h2 id={title}>Usar esta foto numa missão</h2>
        <p className="small muted">A foto continua a mesma — nada é enviado de novo. Depois você confirma se ela mostra o que a missão pede.</p>
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: "55dvh", overflowY: "auto" }}>
          {options.map(({ m, state }) => (
            <li key={m.id}>
              <Link href={`/guardar?missao=${m.slug}&entrada=${entry.id}`} className="card mission-card" style={{ padding: 12 }}>
                <span className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                  <strong>{m.title}</strong>
                  <span className="caption">{collectionTitle(m.collectionId)}{state === "completed" ? " · já concluída, sem pontos" : ""}</span>
                </span>
                {state === "available" ? <span className="chip chip--reward">+{m.xp} XP</span> : null}
                <IconChevron size={18} className="muted" />
              </Link>
            </li>
          ))}
        </ul>
        {options.length === 0 ? <p className="small">Nenhuma missão disponível agora.</p> : null}
        <button type="button" className="btn btn--ghost btn--block" onClick={() => setOpen(false)}>Cancelar</button>
      </Sheet>
    </>
  );
}
