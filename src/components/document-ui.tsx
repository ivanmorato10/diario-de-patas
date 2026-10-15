"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Repository } from "@/data/repository";
import { useBlobUrl, useStore } from "@/data/store";
import { DocumentFileError, processDocument, type ProcessedDocument } from "@/lib/document-file";
import type { HealthDocument } from "@/domain/documents";
import { IconDownload, IconFile } from "./icons";

const EXT: Record<HealthDocument["mime"], string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const fileName = (d: HealthDocument) =>
  `${d.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "documento"}.${EXT[d.mime]}`;

/** Abre o arquivo numa nova aba via blob URL. A aba abre já no clique, para não ser bloqueada. */
export async function openDocument(repo: Repository, d: HealthDocument) {
  const win = window.open("", "_blank");
  const f = await repo.getDocumentFile(d.id);
  if (!f) {
    win?.close();
    return;
  }
  const url = URL.createObjectURL(f.file);
  if (win) win.location.href = url;
  else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadDocument(repo: Repository, d: HealthDocument) {
  const f = await repo.getDocumentFile(d.id);
  if (!f) return;
  const url = URL.createObjectURL(f.file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName(d);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Miniatura da imagem; PDF mostra um ícone. */
export function DocumentThumb({ doc }: { doc: HealthDocument }) {
  const { repo } = useStore();
  const [thumb, setThumb] = useState<Blob | null>(null);
  useEffect(() => {
    let alive = true;
    if (repo && doc.hasThumb) repo.getDocumentFile(doc.id).then((f) => alive && setThumb(f?.thumb ?? null));
    return () => {
      alive = false;
    };
  }, [repo, doc.id, doc.hasThumb]);
  const url = useBlobUrl(thumb);
  return (
    <span className="doc-thumb" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" /> : <IconFile size={26} />}
      {doc.mime === "application/pdf" ? <span className="doc-thumb__tag">PDF</span> : null}
    </span>
  );
}

/** Botões Ver e Baixar de um documento. */
export function DocumentButtons({ doc, compact = false }: { doc: HealthDocument; compact?: boolean }) {
  const { repo } = useStore();
  if (!repo) return null;
  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      <button type="button" className="btn btn--secondary btn--small" onClick={() => openDocument(repo, doc)} aria-label={`Ver ${doc.title}`}>
        <IconFile size={18} /> {compact ? doc.title : "Ver"}
      </button>
      {!compact ? (
        <button type="button" className="btn btn--ghost btn--small" onClick={() => downloadDocument(repo, doc)} aria-label={`Baixar ${doc.title}`}>
          <IconDownload size={18} /> Baixar
        </button>
      ) : null}
    </div>
  );
}

export interface PickedDocument {
  name: string;
  doc: ProcessedDocument;
}

/** Escolher um arquivo (PDF ou imagem), já validado pelos bytes. */
export function DocumentFileInput({
  label, optional, multiple, onChange, value,
}: {
  label: string;
  optional?: boolean;
  multiple?: boolean;
  onChange: (files: PickedDocument[]) => void;
  value: PickedDocument[];
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError(null);
    const out: PickedDocument[] = [];
    const errors: string[] = [];
    for (const f of files) {
      try {
        out.push({ name: f.name || "arquivo", doc: await processDocument(f) });
      } catch (err) {
        errors.push(`${f.name}: ${err instanceof DocumentFileError ? err.message : "Não conseguimos abrir esse arquivo."}`);
      }
    }
    setBusy(false);
    if (errors.length) setError(errors.join(" · "));
    if (out.length) onChange(multiple ? [...value, ...out] : out.slice(0, 1));
  }

  return (
    <div className="field">
      <span id={`${id}-l`} style={{ fontWeight: 600 }}>{label} {optional ? <span className="muted">(opcional)</span> : null}</span>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <button type="button" className="btn btn--secondary btn--small" onClick={() => ref.current?.click()} disabled={busy} aria-describedby={`${id}-l`}>
          <IconFile size={18} /> {busy ? "Preparando…" : value.length && !multiple ? "Trocar arquivo" : "Escolher arquivo"}
        </button>
        {value.length ? <span className="caption" style={{ overflowWrap: "anywhere" }}>{value.map((v) => v.name).join(", ")}</span> : null}
      </div>
      <input ref={ref} type="file" hidden multiple={multiple} accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handle} data-testid={`docfile-${label}`} />
      <details className="tiny-details"><summary>Que arquivos posso usar?</summary><span className="hint">PDF, JPEG, PNG ou WebP até 10 MB. Fotos têm a localização removida.</span></details>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
