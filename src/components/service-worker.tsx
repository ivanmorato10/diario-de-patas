"use client";

import { useEffect } from "react";

/** Registra o service worker só em produção (§15: cache apenas de assets estáticos). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
