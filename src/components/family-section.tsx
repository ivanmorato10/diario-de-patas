"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/i18n/use-error";
import { useStore } from "@/data/store";
import { removeMember, updateMember } from "@/data/family-client";
import { InviteBox } from "./invite-box";
import type { DiaryRole } from "@/domain/types";
import type { Snapshot } from "@/data/demo-repository";
import { setActiveDog } from "@/data/real-repository";

/**
 * Família do diário: cada pessoa entra com a PRÓPRIA conta. O administrador gera um convite com o papel
 * (pode editar / só ver), muda papéis e remove pessoas. Quem não é administrador pode sair do diário.
 */
export function FamilySection() {
  const { snap, reload, patchDog } = useStore();
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

  /** Grava; só com sucesso a lista muda (na hora) e a mensagem aparece. Devolve se gravou. */
  async function run(fn: () => Promise<unknown>, ok?: string, apply?: (s: Snapshot) => Snapshot) {
    setBusy(true);
    setMsg(null);
    const dogAtStart = dog?.id;
    try {
      await fn();
    } catch (e) {
      setMsg(errText(e instanceof Error ? e.message : "familySection.failed"));
      setBusy(false);
      return false;
    }
    if (apply) patchDog(dogAtStart, apply);
    if (ok) setMsg(ok);
    setBusy(false);
    void reload().catch(() => undefined);
    return true;
  }

  async function leave() {
    if (!window.confirm(t("confirmLeave", { dog: dog!.name }))) return;
    const mine = members.find((m) => m.me);
    if (!mine) return;
    // Só sai da tela se o servidor confirmou (antes, uma falha também navegava como se tivesse saído).
    if (!(await run(() => removeMember(mine.userId)))) return;
    setActiveDog(null);
    window.location.assign("/");
  }
  const withMembers = (fn: (ms: NonNullable<Snapshot["members"]>) => NonNullable<Snapshot["members"]>) => (s: Snapshot): Snapshot => ({ ...s, members: fn(s.members ?? []) });

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
                <select className="input member__select" aria-label={t("roleOf", { name: m.name })} value={m.role} disabled={busy} onChange={(e) => { const role = e.target.value as DiaryRole; run(() => updateMember(m.userId, role), t("roleUpdated"), withMembers((ms) => ms.map((x) => (x.userId === m.userId ? { ...x, role } : x)))); }}>
                  <option value="admin">{tf("roles.admin")}</option>
                  <option value="editor">{tf("roles.editor")}</option>
                  <option value="viewer">{tf("roles.viewer")}</option>
                </select>
                {!m.owner ? (
                  <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => window.confirm(t("confirmRemove", { name: m.name, dog: dog.name })) && run(() => removeMember(m.userId), t("removed", { name: m.name }), withMembers((ms) => ms.filter((x) => x.userId !== m.userId)))}>{t("remove")}</button>
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
