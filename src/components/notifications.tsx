"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/data/store";
import { disablePush, enablePush, pushState, setNotifyPrefs, testPush, type PushState } from "@/data/push-client";

/** Sininho de cachorro (sino com orelhinhas e patinha) no topo, com o número de novidades. */
export function DogBell() {
  const { snap } = useStore();
  const n = snap?.unread ?? 0;
  return (
    <Link href="/novidades" className="topbar__person dog-bell" aria-label={n ? `Novidades da família: ${n} ${n === 1 ? "nova" : "novas"}` : "Novidades da família"}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* sino */}
        <path d="M18 16V11a6 6 0 0 0-12 0v5l-1.5 2h15Z" />
        <path d="M10.2 20.5a2 2 0 0 0 3.6 0" />
        {/* orelhinhas caídas de cachorro */}
        <path d="M7.8 6.4C5.2 6.2 3.4 8.6 4 12c.3 1.5 1.6 2 2.4 1l.6-4.6Z" fill="currentColor" stroke="none" />
        <path d="M16.2 6.4c2.6-.2 4.4 2.2 3.8 5.6-.3 1.5-1.6 2-2.4 1l-.6-4.6Z" fill="currentColor" stroke="none" />
        {/* patinha */}
        <ellipse cx="12" cy="14.2" rx="1.6" ry="1.3" fill="currentColor" stroke="none" />
        <circle cx="10" cy="12" r=".75" fill="currentColor" stroke="none" /><circle cx="12" cy="11.2" r=".75" fill="currentColor" stroke="none" /><circle cx="14" cy="12" r=".75" fill="currentColor" stroke="none" />
      </svg>
      {n ? <span className="dog-bell__count" aria-hidden="true">{n > 9 ? "9+" : n}</span> : null}
    </Link>
  );
}

const PUSH_TEXT: Record<PushState, string> = {
  on: "Ligados neste aparelho.",
  off: "Desligados neste aparelho.",
  denied: "Bloqueados nos ajustes do celular. Para ligar, permita as notificações do Diário de Patas nos ajustes do aparelho.",
  "needs-install": "No iPhone, os avisos só chegam com o app instalado na Tela de Início.",
  unsupported: "Este navegador não recebe avisos.",
};

/** Ligar/desligar o push neste aparelho e escolher quais avisos receber. */
export function NotificationSettings() {
  const { snap, reload } = useStore();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const prefs = snap?.me?.notify ?? { photo: true, letter: true, bone: true };
  useEffect(() => { void pushState().then(setState); }, []);

  async function toggle() {
    setBusy(true);
    setMsg(null);
    try {
      setState(state === "on" ? await disablePush() : await enablePush());
    } catch {
      setMsg("Não deu agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }
  /** O servidor diz se aceitou o envio. "Aceito" não é "entregue": quem confirma é o aviso aparecer no celular. */
  async function runTest() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await testPush();
      if (!r.configured) setMsg("Os avisos ainda não estão configurados no servidor.");
      else if (!r.devices) { setMsg("Este aparelho não está registrado. Toque em “Ligar avisos” de novo."); setState("off"); }
      else if (!r.accepted) setMsg("O serviço de avisos recusou o envio. Desligue e ligue os avisos de novo.");
      else setMsg("Enviado para o serviço de avisos. Se não aparecer em alguns segundos, confira as notificações do app nos ajustes do celular.");
    } catch {
      setMsg("Não deu para mandar o teste agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function pref(k: "photo" | "letter" | "bone", v: boolean) {
    await setNotifyPrefs({ ...prefs, [k]: v }).catch(() => setMsg("Não deu para salvar agora."));
    await reload();
  }

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 6 }}>
        <strong>Avisos no celular</strong>
        <span className="caption">{state ? PUSH_TEXT[state] : "…"}</span>
        {state === "on" || state === "off" ? (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className={`btn btn--small ${state === "on" ? "btn--secondary" : "btn--primary"}`} disabled={busy} onClick={toggle}>{busy ? "…" : state === "on" ? "Desligar" : "🔔 Ligar avisos"}</button>
            {state === "on" ? <button type="button" className="btn btn--secondary btn--small" disabled={busy} onClick={runTest}>Mandar um teste</button> : null}
          </div>
        ) : null}
      </div>
      <fieldset className="invite-box__roles">
        <legend className="caption">Me avise quando alguém da família:</legend>
        <label className="check"><input type="checkbox" checked={prefs.photo} onChange={(e) => pref("photo", e.target.checked)} /><span>📸 guardar uma foto</span></label>
        <label className="check"><input type="checkbox" checked={prefs.letter} onChange={(e) => pref("letter", e.target.checked)} /><span>💌 escrever uma cartinha</span></label>
        <label className="check"><input type="checkbox" checked={prefs.bone} onChange={(e) => pref("bone", e.target.checked)} /><span>🦴 der ossinho no que você guardou</span></label>
      </fieldset>
      {msg ? <p className="small" role="status" style={{ margin: 0 }}>{msg}</p> : null}
    </div>
  );
}
