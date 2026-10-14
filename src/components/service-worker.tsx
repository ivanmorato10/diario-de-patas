"use client";

import { useEffect } from "react";

/**
 * Registra o service worker só em produção (§15: cache apenas de assets estáticos).
 * Atualizações: o sw.js é buscado sem cache, conferido ao voltar para o app e, quando muda,
 * a página recarrega uma vez — ninguém fica preso numa versão antiga.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reloading = false;
    const hadController = !!navigator.serviceWorker.controller;
    const onChange = () => {
      if (!hadController || reloading) return; // primeira instalação: não recarrega
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    let reg: ServiceWorkerRegistration | undefined;
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((r) => { reg = r; }).catch(() => undefined);
    // Versão nova publicada? O app instalado no iPhone fica aberto na memória com o código antigo:
    // ao voltar para ele (ou a cada 15 min), compara e recarrega uma vez.
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    const checkVersion = async () => {
      try {
        const r = await fetch("/api/versao", { cache: "no-store" }).then((x) => x.json());
        if (r?.id && mine && r.id !== mine && sessionStorage.getItem("ddp-reloaded-for") !== r.id) {
          sessionStorage.setItem("ddp-reloaded-for", r.id);
          window.location.reload();
        }
      } catch { /* sem conexão: tenta depois */ }
    };
    const timer = setInterval(checkVersion, 15 * 60_000);
    const check = () => { if (document.visibilityState === "visible") { reg?.update().catch(() => undefined); void checkVersion(); } };
    document.addEventListener("visibilitychange", check);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      document.removeEventListener("visibilitychange", check);
      clearInterval(timer);
    };
  }, []);
  return null;
}
