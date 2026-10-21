"use client";

import { useEffect } from "react";
import { isNativeApp, NATIVE_AUTH_CALLBACK } from "@/lib/native";
import { resumeApplePurchases } from "@/lib/apple-iap";

/**
 * Só no app do iPhone: recebe a volta do login do Google/Apple (diariodepatas://auth/callback?code=…) e
 * termina o login dentro do app; e confirma compras da Apple que ficaram abertas (app fechado no meio).
 */
export function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    void (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appUrlOpen", async ({ url }) => {
        if (!url.startsWith(NATIVE_AUTH_CALLBACK)) return;
        const { Browser } = await import("@capacitor/browser");
        await Browser.close().catch(() => undefined);
        // A troca do código pela sessão acontece no próprio app (os cookies do login estão aqui).
        window.location.assign(`/auth/callback${url.slice(NATIVE_AUTH_CALLBACK.length)}`);
      });
      remove = () => void handle.remove();
    })();
    const t = setTimeout(() => void resumeApplePurchases().catch(() => undefined), 4000);
    return () => { remove?.(); clearTimeout(t); };
  }, []);
  return null;
}
