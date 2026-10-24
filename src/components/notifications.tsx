"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useStore } from "@/data/store";
import { rpc } from "@/data/real-repository";
import { disablePush, enablePush, pushState, setNotifyPrefs, testPush, type PushState } from "@/data/push-client";

/** Sininho de cachorro (sino com orelhinhas e patinha) no topo, com o número de novidades. */
export function DogBell() {
  const { snap, patchSnap } = useStore();
  const n = snap?.unread ?? 0;
  const hasDog = !!snap?.dog;
  const t = useTranslations("notify");
  // Mantém a bolinha em dia com fotos, cartinhas, artes e ossinhos da família: a cada minuto com o app
  // aberto e ao voltar para ele (só a contagem, nada pesado).
  useEffect(() => {
    if (!hasDog) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      rpc<{ unread: number }>("unreadCount").then((r) => patchSnap((s) => (s.unread === r.unread ? s : { ...s, unread: r.unread }))).catch(() => undefined);
    };
    refresh();
    const t = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, [hasDog, patchSnap]);
  return (
    <Link href="/novidades" className="topbar__person dog-bell" aria-label={n ? t("bellNew", { count: n }) : t("bell")}>
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

/* Estado do push neste aparelho: notify.state.<estado>. */

/** Ligar/desligar o push neste aparelho e escolher quais avisos receber. */
/** Gravações das preferências de aviso em fila: chegam ao servidor na ordem dos toques. */
let prefQueue: Promise<unknown> = Promise.resolve();
/**
 * Por campo: versão da escolha mais nova (desfazer uma falha nunca passa por cima de um toque mais novo), gravações
 * em andamento e o último valor CONFIRMADO pelo servidor (para onde a caixa volta se a escolha mais nova falhar).
 */
const prefState = {
  photo: { version: 0, pending: 0, confirmed: true, shown: true },
  letter: { version: 0, pending: 0, confirmed: true, shown: true },
  bone: { version: 0, pending: 0, confirmed: true, shown: true },
};

export function NotificationSettings() {
  const { snap, patchSnap } = useStore();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const t = useTranslations("notify");
  const prefs = snap?.me?.notify ?? { photo: true, letter: true, bone: true };
  useEffect(() => { void pushState().then(setState); }, []);

  async function toggle() {
    setBusy(true);
    setMsg(null);
    try {
      setState(state === "on" ? await disablePush() : await enablePush());
    } catch {
      setMsg(t("failed"));
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
      if (!r.configured) setMsg(t("notConfigured"));
      else if (!r.devices) { setMsg(t("notRegistered")); setState("off"); }
      else if (!r.accepted) setMsg(t("refused"));
      else setMsg(t("sent"));
    } catch {
      setMsg(t("testFailed"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * A caixa muda na hora; manda só o campo tocado, em fila (toques rápidos chegam em ordem). Se falhar, a caixa
   * volta ao que era e avisa.
   */
  /** Cada toque inverte o que a tela mostra AGORA (mesmo antes de redesenhar): toques muito rápidos não se perdem. */
  function pref(k: "photo" | "letter" | "bone") {
    const st = prefState[k];
    const set = (val: boolean) => { st.shown = val; patchSnap((s) => (s.me ? { ...s, me: { ...s.me, notify: { ...(s.me.notify ?? { photo: true, letter: true, bone: true }), [k]: val } } } : s)); };
    if (st.pending === 0) { st.confirmed = prefs[k]; st.shown = prefs[k]; } // sem gravação pendente, a tela mostra o que o servidor tem
    const v = !st.shown;
    const version = ++st.version;
    st.pending++;
    set(v);
    setMsg(null);
    prefQueue = prefQueue
      .then(() => setNotifyPrefs({ [k]: v }))
      .then(
        () => { st.confirmed = v; },
        () => {
          // Só a escolha mais recente mexe na caixa; e volta para o último valor confirmado (não o oposto do toque).
          if (st.version === version) set(st.confirmed);
          setMsg(t("saveFailed"));
        },
      )
      .finally(() => { st.pending--; });
  }

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 6 }}>
        <strong>{t("title")}</strong>
        <span className="caption">{state ? t(`state.${state}`) : "…"}</span>
        {state === "on" || state === "off" ? (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className={`btn btn--small ${state === "on" ? "btn--secondary" : "btn--primary"}`} disabled={busy} onClick={toggle}>{busy ? "…" : state === "on" ? t("turnOff") : t("turnOn")}</button>
            {state === "on" ? <button type="button" className="btn btn--secondary btn--small" disabled={busy} onClick={runTest}>{t("test")}</button> : null}
          </div>
        ) : null}
      </div>
      <fieldset className="invite-box__roles">
        <legend className="caption">{t("legend")}</legend>
        <label className="check"><input type="checkbox" checked={prefs.photo} onChange={() => pref("photo")} /><span>{t("photo")}</span></label>
        <label className="check"><input type="checkbox" checked={prefs.letter} onChange={() => pref("letter")} /><span>{t("letter")}</span></label>
        <label className="check"><input type="checkbox" checked={prefs.bone} onChange={() => pref("bone")} /><span>{t("bone")}</span></label>
      </fieldset>
      {msg ? <p className="small" role="status" style={{ margin: 0 }}>{msg}</p> : null}
    </div>
  );
}
