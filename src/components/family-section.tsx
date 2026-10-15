"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { ROLE_PT, removeMember, updateMember } from "@/data/family-client";
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
      setMsg(e instanceof Error ? e.message : "Não deu agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!window.confirm(`Sair do diário de ${dog!.name}? Você deixa de ver as fotos dele. Para voltar, precisa de um novo convite.`)) return;
    const mine = members.find((m) => m.me);
    if (!mine) return;
    await run(async () => { await removeMember(mine.userId); });
    router.replace("/");
  }

  return (
    <section className="card stack" id="familia" aria-labelledby="familia-titulo">
      <h2 id="familia-titulo">Família de {dog.name}</h2>
      <p className="page-note">Cada pessoa entra com a própria conta e vê o mesmo diário. {isAdmin ? "Convide quem cuida junto." : `Seu papel aqui: ${ROLE_PT[me].toLowerCase()}.`}</p>

      <ul className="member-list" role="list">
        {members.map((m) => (
          <li key={m.userId} className="member">
            <span className="member__avatar" aria-hidden="true">{(m.name || "?")[0].toUpperCase()}</span>
            <span className="member__text">
              <strong>{m.name}{m.me ? " (você)" : ""}</strong>
              <span className="caption">{m.email}</span>
            </span>
            {isAdmin && !m.me ? (
              <span className="member__actions">
                <select className="input member__select" aria-label={`Papel de ${m.name}`} value={m.role} disabled={busy} onChange={(e) => run(() => updateMember(m.userId, e.target.value as DiaryRole), "Papel atualizado.")}>
                  <option value="admin">{ROLE_PT.admin}</option>
                  <option value="editor">{ROLE_PT.editor}</option>
                  <option value="viewer">{ROLE_PT.viewer}</option>
                </select>
                {!m.owner ? (
                  <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={() => window.confirm(`Remover ${m.name} do diário de ${dog.name}?`) && run(() => removeMember(m.userId), `${m.name} saiu do diário.`)}>Remover</button>
                ) : null}
              </span>
            ) : (
              <span className="member__role">{ROLE_PT[m.role]}</span>
            )}
          </li>
        ))}
      </ul>

      {isAdmin ? (
        <InviteBox dogName={dog.name} />
      ) : (
        <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={leave}>Sair deste diário</button>
      )}
      {msg ? <p className="small" role="status">{msg}</p> : null}
    </section>
  );
}
