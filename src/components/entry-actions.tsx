"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MISSIONS, type MissionTemplate } from "@/config/catalog";
import { AlbumChecklist } from "./album-picker";
import { COLLECTION_ITEMS } from "@/config/cycle";
import { activeSpecials, missionStatus, type CycleContext } from "@/domain/cycle";
import { missionById } from "@/domain/missions";
import { LIMITS } from "@/config/business";
import { useStore } from "@/data/store";
import { getMedia, DomainError } from "@/data/demo-repository";
import { isCivilDate } from "@/domain/dates";
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

export function EntryActions({ entry, albumIds, today, label }: { entry: DiaryEntry; albumIds: string[]; today: string; label: string }) {
  const { repo, reload } = useStore();
  const [mode, setMode] = useState<"none" | "edit" | "delete">("none");
  const [caption, setCaption] = useState(entry.caption);
  const [date, setDate] = useState(entry.occurredDate);
  const [albums, setAlbums] = useState<string[]>(albumIds);
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
    if (!repo) return;
    if (!isCivilDate(date) || date > today) return setError("Escolha uma data até hoje.");
    setBusy(true);
    try {
      await repo!.updateEntry(entry.id, { caption, occurredDate: date, albumIds: albums });
      await reload();
      setMode("none");
    } catch (e) {
      setError(e instanceof DomainError ? e.message : "Não conseguimos salvar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!repo) return;
    setBusy(true);
    try {
      await repo!.deleteEntry(entry.id);
      setMode("none");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!repo) return;
    const blob = await repo.getMediaBlob(entry.mediaId, "display");
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diario-de-patas-${entry.occurredDate}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
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
        <AlbumChecklist legend="Álbuns" value={albums} onChange={setAlbums} hint={false} />
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
export function UseInMission({ entry, ctx, label }: { entry: DiaryEntry; ctx: CycleContext; label: string }) {
  const [open, setOpen] = useState(false);
  if (entry.source !== "free" || entry.missionId) return null;
  // Do dia (sugestões de hoje), especiais ativas, itens de coleção e o catálogo de missões únicas.
  const today = ctx.plan ? Object.values(ctx.plan.slots).map((id) => missionById(id)!) : [];
  const specials = activeSpecials(ctx.today, ctx.birthDate, ctx.dogName).map((w) => w.mission);
  const pool: MissionTemplate[] = [...today, ...specials, ...COLLECTION_ITEMS, ...MISSIONS];
  const options = pool.map((m) => ({ m, state: missionStatus(m, ctx) }))
    .filter((o) => o.state === "available" || (o.state === "completed" && o.m.kind === "once"))
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
                  <span className="caption">{m.kind === "daily" ? "Missão do dia" : m.kind === "special" ? "Especial" : m.kind === "collection_item" ? "Item de coleção" : collectionTitle(m.collectionId)}{state === "completed" ? " · já concluída, sem pontos" : ""}</span>
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
