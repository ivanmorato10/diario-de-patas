"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/i18n/use-error";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { removeMember, updateMember } from "@/data/family-client";
import { InviteBox } from "./invite-box";
import type { DiaryRole } from "@/domain/types";

/**
 * Família do diário: cada pessoa entra com a PRÓPRIA conta. O administrador gera um convite com o papel
 * (pode editar / só ver), muda papéis e remove pessoas. Quem não é administrador pode sair do diário.
 */
export function FamilySection() {
  const { snap, reload } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const t = useTranslations("familySection");
  const tf = useTranslations("family");
  const errText = useErrorText();
  const dog = snap?.dog;
  const me = snap?.role ?? "admin";
  const members = snap?.members ?? [];
  if (!dog) return null;
  const isAdmin = me === "admin";

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await reload();
      if (ok) setMsg(ok);
    } catch (e) {
      setMsg(errText(e instanceof Error ? e.message : "familySection.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!window.confirm(t("confirmLeave", { dog: dog!.name }))) return;
    const mine = members.find((m) => m.me);
    if (!mine) return;
    await run(async () => { await removeMember(mine.userId); });
    router.replace("/");
  }

  return (
    <section className="card stack" id="familia" aria-labelledby="familia-titulo">
      <h2 id="familia-titulo">{t("title", { dog: dog.name })}</h2>
      <p className="page-note">{t("intro")} {isAdmin ? t("inviteWho") : t("yourRole", { role: tf(`roles.${me}`) })}</p>

      <ul className="member-list" role="list">
        {members.map((m) => (
          <li key={m.userId} className="member">
            <span className="member__avatar" aria-hidden="true">{(m.name || "?")[0].toUpperCase()}</span>
            <span className="member__text">
              <strong>{m.name}{m.me ? ` ${t("you")}` : ""}</strong>
              <span className="caption">{m.email}</span>
            </span>
            {isAdmin && !m.me ? (
              <span className="member__actions">
                <select className="input member__select" aria-label={t("roleOf", { name: m.name })} value={m.role} disabled={busy} onChange={(e) => run(() => updateMember(m.userId, e.target.value as DiaryRole), t("roleUpdated"))}>
                  <option value="admin">{tf("roles.admin")}</option>
                  <option value="editor">{tf("roles.editor")}</option>
                  <option value="viewer">{tf("roles.viewer")}</option>
                </select>
                {!m.owner ? (
                  <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => window.confirm(t("confirmRemove", { name: m.name, dog: dog.name })) && run(() => removeMember(m.userId), t("removed", { name: m.name }))}>{t("remove")}</button>
                ) : null}
              </span>
            ) : (
              <span className="member__role">{tf(`roles.${m.role}`)}</span>
            )}
          </li>
        ))}
      </ul>

      {isAdmin ? (
        <InviteBox dogName={dog.name} />
      ) : (
        <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={leave}>{t("leave")}</button>
      )}
      {msg ? <p className="small" role="status">{msg}</p> : null}
    </section>
  );
}
