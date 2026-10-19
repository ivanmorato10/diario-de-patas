"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { rpc } from "@/data/real-repository";
import { useStore } from "@/data/store";
import { Sheet } from "./entry-actions";
import { IconChevron } from "./icons";
import { ShareActions } from "./share-actions";

interface ReferralInfo { code: string; joined: number; confirmed: number; xpEarned: number; xpPerFriend: number; monthlyCap: number }

/** Indicar o app: link próprio; quando o amigo cria o diário e guarda a primeira foto, o cachorro ganha patinhas. */
export function ShareApp() {
  const { snap } = useStore();
  const t = useTranslations("shareApp");
  const name = snap?.dog?.name ?? t("myDog");
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function show() {
    setOpen(true);
    setError(null);
    try { setInfo(await rpc<ReferralInfo>("referralInfo")); } catch { setError(t("failed")); }
  }

  const link = info ? `${window.location.origin}/?ref=${info.code}` : "";
  const text = t("message", { dog: name, link });

  return (
    <>
      <button type="button" className="card row-between profile-row" onClick={show}>
        <span className="profile-row__text"><span>{t("row")}</span><span className="caption">{t("rowSub")}</span></span><IconChevron />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="share-app-title">
        <h2 id="share-app-title">{t("title")}</h2>
        <p className="page-note">{t("intro", { dog: name, paws: info?.xpPerFriend ?? 20 })}</p>
        {info ? (
          <div className="stack" style={{ gap: 10 }}>
            <input className="input" readOnly value={link} aria-label={t("linkLabel")} onFocus={(e) => e.currentTarget.select()} />
            <ShareActions text={text} onCopyError={() => setError(t("copyFailed"))} />
            <p className="caption" style={{ margin: 0 }}>
              {info.joined === 0 ? t("nobody") : t("joined", { count: info.joined, paws: info.xpEarned })}
              {" "}{t("cap", { cap: info.monthlyCap })}
            </p>
          </div>
        ) : !error ? <p className="caption">{t("preparing")}</p> : null}
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={() => setOpen(false)}>{t("close")}</button>
      </Sheet>
    </>
  );
}
