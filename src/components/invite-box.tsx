"use client";

import { useState } from "react";
import { ROLE_PT, createInvite } from "@/data/family-client";
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

  async function generate() {
    setBusy(true);
    setMsg(null);
    try { setInvite(await createInvite(role)); } catch (e) { setMsg(e instanceof Error ? e.message : "Não deu para gerar o convite."); } finally { setBusy(false); }
  }

  const site = typeof window !== "undefined" ? window.location.origin : "";
  const link = invite ? `${site}/convite?codigo=${invite.code}` : "";
  const text = invite ? `Oi! Te convidei para o diário de ${dogName} no Diário de Patas (${ROLE_PT[invite.role].toLowerCase()}). Abra o link e entre com a sua conta: ${link}\nOu digite o código ${invite.code} em "Tenho um código de convite". Vale por 7 dias.` : "";

  if (invite) {
    return (
      <div className="invite-code">
        <span className="invite-code__label">Convite · {ROLE_PT[invite.role]}</span>
        <strong className="invite-code__value">{invite.code}</strong>
        <span className="caption">Vale por 7 dias e só pode ser usado uma vez.</span>
        <ShareActions text={text} onCopyError={() => setMsg("Não deu para copiar automaticamente: toque e segure no código para copiar.")} />
        <button type="button" className="sp-link" onClick={() => setInvite(null)}>Fazer outro convite</button>
        {msg ? <p className="small" role="status">{msg}</p> : null}
      </div>
    );
  }

  return (
    <div className="invite-box">
      <fieldset className="invite-box__roles">
        <legend className="caption">A pessoa vai poder:</legend>
        <label className="check"><input type="radio" name="invite-role" checked={role === "editor"} onChange={() => setRole("editor")} /><span><strong>Pode adicionar momentos</strong> · fotos, cartinhas e cuidados</span></label>
        <label className="check"><input type="radio" name="invite-role" checked={role === "viewer"} onChange={() => setRole("viewer")} /><span><strong>Pode acompanhar</strong> · vê tudo e dá ossinho, sem alterar</span></label>
      </fieldset>
      <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={generate}>{busy ? "Gerando…" : "Gerar convite"}</button>
      {msg ? <p className="small" role="status">{msg}</p> : null}
    </div>
  );
}
