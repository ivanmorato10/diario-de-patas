"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useCatalog } from "@/i18n/catalog";
import { useErrorText } from "@/i18n/use-error";
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

/**
 * Janela de baixo (dialog). Com `onAttemptClose`, Esc e toque fora NÃO fecham direto: chamam essa
 * função, e quem usa decide (ex.: perguntar se quer salvar alterações).
 */
export function Sheet({ open, onClose, labelledBy, children, onAttemptClose }: { open: boolean; onClose: () => void; labelledBy: string; children: React.ReactNode; onAttemptClose?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-labelledby={labelledBy} onClose={onClose}
      onCancel={(e) => { if (onAttemptClose) { e.preventDefault(); onAttemptClose(); } }}
      onClick={(e) => { if (e.target !== ref.current) return; if (onAttemptClose) onAttemptClose(); else onClose(); }}>
      <div className="sheet__body">{children}</div>
    </dialog>
  );
}

export function EntryActions({ entry, albumIds, today, label }: { entry: DiaryEntry; albumIds: string[]; today: string; label: string }) {
  const { repo, reload, patchSnap } = useStore();
  const [mode, setMode] = useState<"none" | "edit" | "delete">("none");
  const [caption, setCaption] = useState(entry.caption);
  const [date, setDate] = useState(entry.occurredDate);
  const [albums, setAlbums] = useState<string[]>(albumIds);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useTranslations("entry");
  const errText = useErrorText();

  function openEdit() {
    setCaption(entry.caption);
    setDate(entry.occurredDate);
    setAlbums(albumIds);
    setError(null);
    setMode("edit");
  }

  async function saveEdit() {
    if (!repo) return;
    if (!isCivilDate(date) || date > today) return setError(errText("errors.dateUpToToday"));
    setBusy(true);
    try {
      await repo!.updateEntry(entry.id, { caption, occurredDate: date, albumIds: albums });
    } catch (e) {
      setError(errText(e instanceof DomainError ? e : null, "errors.saveFailed"));
      setBusy(false);
      return;
    }
    // Gravou: a tela muda na hora e fecha; a atualização completa vem depois (se falhar, não vira "não salvou").
    patchSnap((s) => ({ ...s, entries: s.entries.map((x) => (x.id === entry.id ? { ...x, caption, occurredDate: date } : x)) }));
    setBusy(false);
    setMode("none");
    void reload().catch(() => undefined);
  }

  async function confirmDelete() {
    if (!repo) return;
    setBusy(true);
    try {
      await repo!.deleteEntry(entry.id);
      patchSnap((s) => ({ ...s, entries: s.entries.filter((x) => x.id !== entry.id), albumEntries: s.albumEntries.filter((x) => x.entryId !== entry.id) }));
      setMode("none");
      void reload().catch(() => undefined);
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
        <button type="button" className="icon-btn edit-only" onClick={openEdit} aria-label={t("editLabel", { label })}><IconPencil /></button>
        <button type="button" className="icon-btn" onClick={download} aria-label={t("downloadLabel", { label })}><IconDownload /></button>
        <button type="button" className="icon-btn edit-only" onClick={() => setMode("delete")} aria-label={t("deleteLabel", { label })} style={{ color: "var(--danger)" }}><IconTrash /></button>
      </div>

      <Sheet open={mode === "edit"} onClose={() => setMode("none")} labelledBy={editTitle}>
        <h2 id={editTitle}>{t("editTitle")}</h2>
        <div className="field">
          <label htmlFor={`cap-${entry.id}`}>{t("caption")}</label>
          <textarea id={`cap-${entry.id}`} className="textarea" value={caption} maxLength={LIMITS.captionMaxChars} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`date-${entry.id}`}>{t("when")}</label>
          <input id={`date-${entry.id}`} type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
        <AlbumChecklist legend={t("albums")} value={albums} onChange={setAlbums} hint={false} />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="stack">
          <button type="button" className="btn btn--primary btn--block" onClick={saveEdit} disabled={busy}>{t("save")}</button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setMode("none")}>{t("cancel")}</button>
        </div>
      </Sheet>

      <Sheet open={mode === "delete"} onClose={() => setMode("none")} labelledBy={delTitle}>
        <h2 id={delTitle}>{t("deleteTitle")}</h2>
        <p>{t("deleteText")} {entry.missionId ? t("deleteKeeps") : ""} {t("noUndo")}</p>
        <div className="stack">
          <button type="button" className="btn btn--danger btn--block" onClick={confirmDelete} disabled={busy}>{t("delete")}</button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setMode("none")}>{t("cancel")}</button>
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
  const t = useTranslations("entry");
  if (entry.source !== "free" || entry.missionId) return null;
  return (
    <>
      <button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(true)} aria-label={t("useLabel", { label })}>
        <IconStar size={18} /> {t("use")}
      </button>
      {/* A lista só é montada com a janela aberta: o Diário não monta uma lista por foto à toa. */}
      {open ? <UseInMissionSheet entry={entry} ctx={ctx} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function UseInMissionSheet({ entry, ctx, onClose }: { entry: DiaryEntry; ctx: CycleContext; onClose: () => void }) {
  const t = useTranslations("entry");
  const tm = useTranslations("mission");
  const cat = useCatalog(useStore().snap?.dog?.name ?? "");
  // Do dia (sugestões de hoje), especiais ativas, itens de coleção e o catálogo de missões únicas.
  const today = ctx.plan ? Object.values(ctx.plan.slots).map((id) => missionById(id)!) : [];
  const specials = activeSpecials(ctx.today, ctx.birthDate, ctx.region).map((w) => w.mission);
  const pool: MissionTemplate[] = [...today, ...specials, ...COLLECTION_ITEMS, ...MISSIONS];
  const options = pool.map((m) => ({ m, state: missionStatus(m, ctx) }))
    .filter((o) => o.state === "available" || (o.state === "completed" && o.m.kind === "once"))
    .sort((a, b) => Number(a.state === "completed") - Number(b.state === "completed"));
  const title = `use-${entry.id}`;
  return (
    <Sheet open onClose={onClose} labelledBy={title}>
      <h2 id={title}>{t("useTitle")}</h2>
      <p className="page-note">{t("useNote")}</p>
      <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: "55dvh", overflowY: "auto" }}>
        {options.map(({ m, state }) => (
          <li key={m.id}>
            <Link href={`/guardar?missao=${m.slug}&entrada=${entry.id}`} className="card mission-card" style={{ padding: 12 }}>
              <span className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                <strong>{cat.title(m)}</strong>
                <span className="caption">{m.kind === "once" ? cat.collection(m.collectionId).title : tm(`kind.${m.kind}`)}{state === "completed" ? ` · ${t("alreadyDone")}` : ""}</span>
              </span>
              {state === "available" ? <span className="chip chip--reward">+{m.xp} 🐾</span> : null}
              <IconChevron size={18} className="muted" />
            </Link>
          </li>
        ))}
      </ul>
      {options.length === 0 ? <p className="small">{t("noneAvailable")}</p> : null}
      <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>{t("cancel")}</button>
    </Sheet>
  );
}
