"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/entry-actions";

/**
 * PWA: opção discreta "Instalar aplicativo" e aviso de sem conexão.
 * - Já aberto como app (standalone): nada aparece.
 * - iPhone/iPad no Safari: instruções Compartilhar → Adicionar à Tela de Início (o iOS não instala sozinho).
 * - Chrome/Edge/Android: usa o pedido de instalação do navegador quando ele oferece.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function platform() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // No iOS só o Safari adiciona à Tela de Início com o ícone do app (Chrome/Firefox no iPhone também podem, pelo menu Compartilhar, a partir do iOS 16.4).
  const iosOtherBrowser = ios && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return { ios, iosOtherBrowser };
}

let deferred: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
  });
}

export function useInstall() {
  const [state, setState] = useState<{ show: boolean; ios: boolean; iosOtherBrowser: boolean; canPrompt: boolean }>({ show: false, ios: false, iosOtherBrowser: false, canPrompt: false });
  useEffect(() => {
    const update = () => {
      if (isStandalone()) return setState((s) => ({ ...s, show: false }));
      const p = platform();
      setState({ show: p.ios || !!deferred, ios: p.ios, iosOtherBrowser: p.iosOtherBrowser, canPrompt: !!deferred });
    };
    update();
    const onPrompt = () => setTimeout(update, 0);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", update);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", update);
    };
  }, []);
  return state;
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: "-4px" }}>
      <path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

/** Link discreto; `variant="splash"` usa as cores da tela de entrada. */
export function InstallAppLink({ variant = "default" }: { variant?: "default" | "splash" }) {
  const { show, ios, iosOtherBrowser, canPrompt } = useInstall();
  const [open, setOpen] = useState(false);
  if (!show) return null;

  async function click() {
    if (!ios && canPrompt && deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => undefined);
      deferred = null;
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button type="button" className={variant === "splash" ? "install-link install-link--splash" : "install-link"} onClick={click}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></svg>
        Instalar aplicativo
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="install-title">
        <h2 id="install-title">Diário de Patas na Tela de Início</h2>
        <p className="muted">Fica com ícone próprio e abre em tela cheia, como um aplicativo. É grátis e não precisa da App Store.</p>
        {iosOtherBrowser ? (
          <p className="notice notice--info small"><span>Se não aparecer a opção, abra <strong>diario-de-patas.vercel.app</strong> no <strong>Safari</strong> e repita os passos.</span></p>
        ) : null}
        <ol className="install-steps">
          <li>Toque em <strong>Compartilhar</strong> <ShareIcon /> na barra do {iosOtherBrowser ? "navegador" : "Safari"} (embaixo ou em cima da tela).</li>
          <li>Role a lista e toque em <strong>Adicionar à Tela de Início</strong>.</li>
          <li>Confirme em <strong>Adicionar</strong>. O ícone do Abu aparece na sua tela.</li>
        </ol>
        <p className="caption">Abra sempre pelo ícone. Se você entrou pelo navegador, entre de novo no app: o login do app instalado é separado do Safari.</p>
        <button type="button" className="btn btn--secondary btn--block" onClick={() => setOpen(false)}>Entendi</button>
      </Sheet>
    </>
  );
}

/** Faixa no topo quando a conexão cai: nada é dado como enviado sem internet. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="offline-banner" role="status">
      Sem conexão. Fotos e mudanças só são salvas quando a internet voltar.
    </div>
  );
}
