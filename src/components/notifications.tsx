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
        <path d="M6.2 9.2 4 5.5l3.8 1.2" /><path d="M17.8 9.2 20 5.5l-3.8 1.2" />
        <path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 1.5h-15Z" />
        <path d="M10 21a2 2 0 0 0 4 0" />
        <circle cx="12" cy="13.6" r="1.2" fill="currentColor" stroke="none" /><circle cx="10.1" cy="11.6" r=".75" fill="currentColor" stroke="none" /><circle cx="13.9" cy="11.6" r=".75" fill="currentColor" stroke="none" />
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
            {state === "on" ? <button type="button" className="btn btn--secondary btn--small" onClick={async () => { await testPush(); setMsg("Mandamos um aviso de teste. Ele deve aparecer em instantes."); }}>Mandar um teste</button> : null}
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
