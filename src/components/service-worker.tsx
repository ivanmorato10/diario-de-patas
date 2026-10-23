"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Houve troca de tela dentro do app nesta aba (sessionStorage). */
export const IN_APP_NAV = "ddp_in_app_nav";

/**
 * Registra o service worker só em produção (§15: cache apenas de assets estáticos).
 * Atualizações: o sw.js é buscado sem cache e conferido ao voltar para o app. Quando há versão nova, a página
 * recarrega uma vez, mas NUNCA no meio do uso (antes, recarregar logo ao voltar para o app engolia o toque que a
 * pessoa dava naquele instante): só quando ela muda de tela ou sai do app. Ninguém fica preso numa versão antiga.
 */
export function ServiceWorker() {
  const pathname = usePathname();
  const pending = useRef(false);
  const first = useRef(true);

  // Versão nova esperando: a próxima troca de tela já abre a versão nova (é uma navegação de qualquer jeito).
  // Também marca que houve navegação dentro do app nesta aba ("voltar" de Termos/Privacidade volta uma página).
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    try { sessionStorage.setItem(IN_APP_NAV, "1"); } catch { /* sem armazenamento: "voltar" usa o destino padrão */ }
    if (pending.current) window.location.reload();
  }, [pathname]);

  useEffect(() => {
    // :active (o botão afundar) aparece já no toque no iPhone só quando existe um ouvinte de toque na página.
    const noop = () => undefined;
    document.addEventListener("touchstart", noop, { passive: true });
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return () => document.removeEventListener("touchstart", noop);
    const markPending = () => { pending.current = true; };
    const hadController = !!navigator.serviceWorker.controller;
    const onChange = () => { if (hadController) markPending(); }; // primeira instalação: não recarrega
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    let reg: ServiceWorkerRegistration | undefined;
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((r) => { reg = r; }).catch(() => undefined);
    // Versão nova publicada? O app instalado no iPhone fica aberto na memória com o código antigo:
    // ao voltar para ele (ou a cada 15 min), compara; se mudou, recarrega na próxima troca de tela ou ao sair.
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    const checkVersion = async () => {
      try {
        const r = await fetch("/api/versao", { cache: "no-store" }).then((x) => x.json());
        if (r?.id && mine && r.id !== mine && sessionStorage.getItem("ddp-reloaded-for") !== r.id) {
          sessionStorage.setItem("ddp-reloaded-for", r.id);
          markPending();
        }
      } catch { /* sem conexão: tenta depois */ }
    };
    const timer = setInterval(checkVersion, 15 * 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (pending.current) window.location.reload(); // saiu do app: ao voltar, já está na versão nova
        return;
      }
      reg?.update().catch(() => undefined);
      void checkVersion();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("touchstart", noop);
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(timer);
    };
  }, []);
  return null;
}
