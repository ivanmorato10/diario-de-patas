"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { ROLE_PT, createInvite, removeMember, updateMember } from "@/data/family-client";
import type { DiaryRole } from "@/domain/types";

/**
 * Família do diário: cada pessoa entra com a PRÓPRIA conta. O administrador gera um convite com o papel
 * (pode editar / só ver), muda papéis e remove pessoas. Quem não é administrador pode sair do diário.
 */
export function FamilySection() {
  const { snap, reload } = useStore();
  const router = useRouter();
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [invite, setInvite] = useState<{ code: string; role: DiaryRole; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  async function generate() {
    setBusy(true);
    setMsg(null);
    setCopied(false);
    try { setInvite(await createInvite(role)); } catch (e) { setMsg(e instanceof Error ? e.message : "Não deu para gerar o convite."); } finally { setBusy(false); }
  }

  const site = typeof window !== "undefined" ? window.location.origin : "";
  const link = invite ? `${site}/convite?codigo=${invite.code}` : "";
  const text = invite ? `Oi! Te convidei para o diário de ${dog.name} no Diário de Patas (${ROLE_PT[invite.role].toLowerCase()}). Abra o link e entre com a sua conta: ${link}\nOu digite o código ${invite.code} em "Tenho um código de convite". Vale por 7 dias.` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setMsg("Não deu para copiar automaticamente: toque e segure no código para copiar.");
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
      <p className="page-note">Cada pessoa entra com a própria conta e vê o mesmo diário. {isAdmin ? "Convide quem cuida junto: escolha se a pessoa pode editar ou só ver." : `Seu papel aqui: ${ROLE_PT[me].toLowerCase()}.`}</p>

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
        invite ? (
          <div className="invite-code">
            <span className="invite-code__label">Convite · {ROLE_PT[invite.role]}</span>
            <strong className="invite-code__value">{invite.code}</strong>
            <span className="caption">Vale por 7 dias e só pode ser usado uma vez.</span>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <a className="btn btn--primary btn--small" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener">Enviar pelo WhatsApp</a>
              <button type="button" className={`btn btn--small ${copied ? "btn--primary" : "btn--secondary"}`} onClick={copy} aria-live="polite">{copied ? "✓ Copiado!" : "Copiar convite"}</button>
            </div>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setInvite(null)}>Fazer outro convite</button>
          </div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            <div className="filter-row" role="radiogroup" aria-label="Papel de quem vai entrar">
              {(["editor", "viewer"] as const).map((r) => (
                <button key={r} type="button" role="radio" aria-checked={role === r} className={`filter-chip${role === r ? " is-active" : ""}`} onClick={() => setRole(r)}>{ROLE_PT[r]}</button>
              ))}
            </div>
            <p className="caption">{role === "editor" ? "Pode guardar fotos, fazer missões, cuidar da saúde e usar os créditos do Estúdio." : "Vê fotos, álbuns e cuidados, sem alterar nada."}</p>
            <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={generate}>{busy ? "Gerando…" : "Gerar convite"}</button>
          </div>
        )
      ) : (
        <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={leave}>Sair deste diário</button>
      )}
      {msg ? <p className="small" role="status">{msg}</p> : null}
    </section>
  );
}
