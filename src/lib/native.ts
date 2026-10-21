/**
 * App do iPhone (App Store): o mesmo site rodando dentro do Capacitor. Aqui só o que muda dentro dele:
 * - login com Google/Apple abre no navegador do sistema (o Google não deixa entrar dentro do app) e volta pelo
 *   endereço diariodepatas://auth/callback;
 * - créditos pela compra da própria Apple (regra da App Store), em vez de Pix ou cartão.
 */
import { Capacitor } from "@capacitor/core";

export const APP_SCHEME = "diariodepatas";
export const NATIVE_AUTH_CALLBACK = `${APP_SCHEME}://auth/callback`;

/** true só dentro do app do iPhone (no navegador e no app instalado pela tela de início é false). */
export const isNativeApp = () => typeof window !== "undefined" && Capacitor.isNativePlatform();

/** Abre o login do Google/Apple no navegador do sistema (dentro do app). */
export async function openNativeAuth(url: string) {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover" });
}
