"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REAL_MODE } from "@/config/mode";
import { DomainError } from "@/data/demo-repository";
import type { ShareLink } from "@/data/repository";
import { useStore } from "@/data/store";
import { formatCivilDate } from "@/domain/dates";
import { IconAlert, IconShare } from "./icons";

/** Criar um link só com as fotos escolhidas (briefing §12). O link aparece uma única vez. */
export function ShareSelection({ selected, defaultTitle, onDone }: { selected: string[]; defaultTitle: string; onDone: () => void }) {
  const { repo } = useStore();
  const [title, setTitle] = useState(defaultTitle);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!REAL_MODE) {
    return (
      <>
        <button type="button" className="btn btn--primary btn--small" disabled aria-describedby="share-off">Criar link</button>
        <p id="share-off" className="caption">Links de compartilhamento precisam de conta e servidor para poderem ser revogados com segurança. Nada foi enviado.</p>
      </>
    );
  }
  if (url) {
    return (
      <div className="stack" role="status">
        <p className="small"><strong>Link criado.</strong> Guarde agora — por segurança ele não é mostrado de novo.</p>
        <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Link do álbum compartilhado" />
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="btn btn--primary btn--small" onClick={async () => { await navigator.clipboard?.writeText(url).catch(() => undefined); setCopied(true); }}>{copied ? "✓ Copiado!" : "Copiar link"}</button>
          <button type="button" className="btn btn--ghost btn--small" onClick={onDone}>Concluir</button>
        </div>
        <p className="caption">Quem tiver o link pode ver e copiar estas fotos. Você pode revogar em Perfil e ajustes; revogar não apaga cópias já baixadas.</p>
      </div>
    );
  }
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault();
      if (!repo || busy) return;
      setBusy(true);
      setError(null);
      try {
        const r = await repo.createShare(title, selected);
        setUrl(`${window.location.origin}${r.path}`);
      } catch (err) {
        setError(err instanceof DomainError ? err.message : "Não conseguimos criar o link. Tente de novo.");
      } finally {
        setBusy(false);
      }
    }}>
      <div className="field">
        <label htmlFor="share-title">Título do link</label>
        <input id="share-title" className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <p className="caption">Se houver outras pessoas nas fotos, garanta que elas concordam antes de compartilhar.</p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn--primary btn--small" disabled={busy || selected.length === 0}>{busy ? "Criando…" : `Criar link com ${selected.length} ${selected.length === 1 ? "foto" : "fotos"}`}</button>
    </form>
  );
}

/** Links ativos e revogados, com “Revogar” (Perfil e ajustes). */
export function ShareLinksList() {
  const { repo } = useStore();
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => repo?.listShares().then(setLinks, () => setError("Não conseguimos carregar os links."));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);
  if (!REAL_MODE) return <p className="small muted">Nenhum link ativo. Compartilhamento chega junto com contas.</p>;
  if (error) return <p className="field-error" role="alert"><IconAlert size={16} /> {error}</p>;
  if (!links) return <p className="small muted">Carregando…</p>;
  const active = links.filter((l) => !l.revokedAt);
  if (!active.length) return <p className="small muted">Nenhum link ativo. Para criar, selecione fotos em um <Link href="/albuns">álbum</Link>.</p>;
  return (
    <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {active.map((l) => (
        <li key={l.id} className="row-between" style={{ gap: 8 }}>
          <span className="stack" style={{ gap: 0, minWidth: 0 }}>
            <strong style={{ overflowWrap: "anywhere" }}><IconShare size={16} /> {l.title}</strong>
            <span className="caption">{l.count} {l.count === 1 ? "foto" : "fotos"} · criado em {formatCivilDate(l.createdAt.slice(0, 10))}</span>
          </span>
          <button type="button" className="btn btn--danger-outline btn--small" onClick={async () => { await repo?.revokeShare(l.id); await load(); }} aria-label={`Revogar o link ${l.title}`}>Revogar</button>
        </li>
      ))}
    </ul>
  );
}
