"use client";

import { ShareActions } from "./share-actions";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/i18n/use-format";
import { useErrorText } from "@/i18n/use-error";
import { DomainError } from "@/data/demo-repository";
import type { ShareLink } from "@/data/repository";
import { useStore } from "@/data/store";
import { IconAlert, IconShare } from "./icons";

/** Criar um link só com as fotos escolhidas (briefing §12). O link aparece uma única vez. */
export function ShareSelection({ selected, defaultTitle, onDone }: { selected: string[]; defaultTitle: string; onDone: () => void }) {
  const { repo } = useStore();
  const [title, setTitle] = useState(defaultTitle);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("share");
  const errText = useErrorText();

  if (url) {
    return (
      <div className="stack" role="status">
        <p className="small">{t.rich("created", { strong: (c) => <strong>{c}</strong> })}</p>
        <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} aria-label={t("linkLabel")} />
        <ShareActions text={url} copyLabel={t("copyLink")} />
        <button type="button" className="btn btn--secondary btn--block" onClick={onDone}>{t("done")}</button>
        <p className="caption">{t("whoCanSee")}</p>
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
        setError(errText(err instanceof DomainError ? err : null, "share.createFailed"));
      } finally {
        setBusy(false);
      }
    }}>
      <div className="field">
        <label htmlFor="share-title">{t("titleLabel")}</label>
        <input id="share-title" className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <p className="caption">{t("consent")}</p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn--primary btn--small" disabled={busy || selected.length === 0} aria-busy={busy ? "true" : undefined}>{busy ? t("creating") : t("create", { count: selected.length })}</button>
    </form>
  );
}

/** Links ativos e revogados, com “Revogar” (Perfil e ajustes). */
export function ShareLinksList() {
  const { repo } = useStore();
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const t = useTranslations("share");
  const f = useFormat();
  const load = () => repo?.listShares().then(setLinks, () => setError(t("loadFailed")));
  /** Revoga e confere na lista do servidor; se falhar, o link continua listado e aparece o aviso. */
  async function revoke(id: string) {
    if (!repo || revoking) return;
    setRevoking(id);
    setRevokeError(null);
    try {
      await repo.revokeShare(id);
      setLinks((ls) => ls?.map((l) => (l.id === id ? { ...l, revokedAt: new Date().toISOString() } : l)) ?? ls);
      void load();
    } catch {
      setRevokeError(id);
    } finally {
      setRevoking(null);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);
  if (error) return <p className="field-error" role="alert"><IconAlert size={16} /> {error}</p>;
  if (!links) return <p className="small muted">{t("loading")}</p>;
  const active = links.filter((l) => !l.revokedAt);
  if (!active.length) return <p className="small muted">{t.rich("none", { link: (c) => <Link href="/albuns">{c}</Link> })}</p>;
  return (
    <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {active.map((l) => (
        <li key={l.id} className="row-between" style={{ gap: 8 }}>
          <span className="stack" style={{ gap: 0, minWidth: 0 }}>
            <strong style={{ overflowWrap: "anywhere" }}><IconShare size={16} /> {l.title}</strong>
            <span className="caption">{t("linkMeta", { count: l.count, date: f.instant(l.createdAt, { day: "numeric", month: "long", year: "numeric" }) })}</span>
          </span>
          <button type="button" className="btn btn--danger-outline btn--small" disabled={!!revoking} onClick={() => void revoke(l.id)} aria-label={t("revokeLabel", { title: l.title })}>{revoking === l.id ? t("revoking") : t("revoke")}</button>
          {revokeError === l.id ? <span className="field-error" role="alert" style={{ flexBasis: "100%" }}>{t("revokeFailed")}</span> : null}
        </li>
      ))}
    </ul>
  );
}
