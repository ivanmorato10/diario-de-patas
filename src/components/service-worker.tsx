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
    const check = () => { if (document.visibilityState === "visible") reg?.update().catch(() => undefined); };
    document.addEventListener("visibilitychange", check);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return null;
}
