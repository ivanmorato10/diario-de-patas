"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/i18n/use-error";
import { createInvite } from "@/data/family-client";
import type { DiaryRole } from "@/domain/types";
import { ShareActions } from "./share-actions";

/**
 * Gerar convite da família: o papel é uma escolha simples, logo acima do botão;
 * o código sai na hora, com WhatsApp e "✓ Copiado!". Usado em Ajustes e no convite do Abu no Hoje.
 */
export function InviteBox({ dogName }: { dogName: string }) {
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [invite, setInvite] = useState<{ code: string; role: DiaryRole } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const t = useTranslations("inviteBox");
  const tf = useTranslations("family");
  const errText = useErrorText();

  async function generate() {
    setBusy(true);
    setMsg(null);
    try { setInvite(await createInvite(role)); } catch (e) { setMsg(errText(e instanceof Error ? e.message : "inviteBox.failed")); } finally { setBusy(false); }
  }

  const site = typeof window !== "undefined" ? window.location.origin : "";
  const link = invite ? `${site}/convite?codigo=${invite.code}` : "";
  // Mensagem no idioma de quem convida (é ela quem envia); o link abre no idioma de quem recebe.
  const text = invite ? t("message", { dog: dogName, role: tf(`roles.${invite.role}`).toLocaleLowerCase(), link, code: invite.code }) : "";

  if (invite) {
    return (
      <div className="invite-code">
        <span className="invite-code__label">{t("label", { role: tf(`roles.${invite.role}`) })}</span>
        <strong className="invite-code__value">{invite.code}</strong>
        <span className="caption">{t("valid")}</span>
        <ShareActions text={text} onCopyError={() => setMsg(t("copyFailed"))} />
        <button type="button" className="sp-link" onClick={() => setInvite(null)}>{t("another")}</button>
        {msg ? <p className="small" role="status">{msg}</p> : null}
      </div>
    );
  }

  return (
    <div className="invite-box">
      <fieldset className="invite-box__roles">
        <legend className="caption">{t("canDo")}</legend>
        <label className="check"><input type="radio" name="invite-role" checked={role === "editor"} onChange={() => setRole("editor")} /><span className="check__text"><strong>{tf("roles.editor")}</strong><span className="caption">{tf("roleHelp.editor")}</span></span></label>
        <label className="check"><input type="radio" name="invite-role" checked={role === "viewer"} onChange={() => setRole("viewer")} /><span className="check__text"><strong>{tf("roles.viewer")}</strong><span className="caption">{tf("roleHelp.viewer")}</span></span></label>
      </fieldset>
      <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={generate}>{busy ? t("generating") : t("generate")}</button>
      {msg ? <p className="small" role="status">{msg}</p> : null}
    </div>
  );
}
