"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/i18n/use-error";
import { useStore } from "@/data/store";
import { rpc } from "@/data/real-repository";
import { DogAvatar } from "./media";

/** Minha conta: diários de outras pessoas em que você participa, com "Sair" (inclusive para quem só acompanha). */
export function FamilyDiaries() {
  const { snap, reload, patchSnap } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const t = useTranslations("familyDiaries");
  const tf = useTranslations("family");
  const errText = useErrorText();
  const others = (snap?.diaries ?? []).filter((d) => !d.mine);
  if (!others.length) return null;

  async function leave(id: string, name: string) {
    if (!window.confirm(t("confirmLeave", { dog: name }))) return;
    setBusy(id);
    setMsg(null);
    try {
      await rpc("leaveDiary", { dogId: id });
    } catch (e) {
      setMsg(errText(e instanceof Error ? e.message : "familyDiaries.leaveFailed"));
      setBusy(null);
      return;
    }
    setBusy(null);
    // Sem nenhum cachorro: volta para "Qual é o seu caso?" (cadastrar um ou usar um convite), com o app do zero.
    if ((snap?.diaries?.length ?? 0) <= 1) { window.location.assign("/"); return; }
    patchSnap((s) => ({ ...s, diaries: (s.diaries ?? []).filter((d) => d.id !== id) }));
    setMsg(t("left", { dog: name }));
    void reload().catch(() => undefined);
  }

  return (
    <section className="stack" aria-labelledby="familias">
      <h2 id="familias">{t("title")}</h2>
      <ul className="dog-list" role="list" style={{ margin: 0 }}>
        {others.map((d) => (
          <li key={d.id} className="dog-list__row">
            <div className="dog-list__item" style={{ cursor: "default" }}>
              <DogAvatar mediaId={d.photoMediaId} name={d.name} crop={d.avatarCrop} decorative />
              <span className="dog-list__text"><strong>{d.name}</strong><span className="caption">{tf(`roles.${d.role}`)}</span></span>
            </div>
            <button type="button" className="btn btn--secondary btn--small" style={{ alignSelf: "center" }} disabled={!!busy} onClick={() => leave(d.id, d.name)} aria-busy={busy === d.id ? "true" : undefined}>{busy === d.id ? t("leaving") : t("leave")}</button>
          </li>
        ))}
      </ul>
      {msg ? <p className="small" role="status" style={{ margin: 0 }}>{msg}</p> : null}
    </section>
  );
}
