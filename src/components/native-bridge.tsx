"use client";

import { useEffect } from "react";
import { isNativeApp, NATIVE_AUTH_CALLBACK } from "@/lib/native";
import { listenAppleUpdates, resumeApplePurchases } from "@/lib/apple-iap";

/**
 * Só no app do iPhone: recebe a volta do login do Google/Apple (diariodepatas://auth/callback?code=…) e
 * termina o login dentro do app; abre a tela certa ao tocar num aviso; e confirma compras da Apple que ficaram
 * abertas (app fechado no meio).
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
      // Toque num aviso: abre o que ele mostra (só caminhos internos).
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const tap = await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const to = (notification.data as { url?: string } | undefined)?.url;
        if (to && to.startsWith("/") && !to.startsWith("//")) window.location.assign(to);
      });
      // Compras da Apple em aberto: confere ao voltar para o app e quando a Apple avisar (aprovação depois).
      const back = await App.addListener("appStateChange", ({ isActive }) => { if (isActive) void resumeApplePurchases().catch(() => undefined); });
      const stopApple = await listenAppleUpdates().catch(() => () => {});
      remove = () => { void handle.remove(); void tap.remove(); void back.remove(); stopApple(); };
    })();
    const t = setTimeout(() => void resumeApplePurchases().catch(() => undefined), 4000);
    return () => { remove?.(); clearTimeout(t); };
  }, []);
  return null;
}
