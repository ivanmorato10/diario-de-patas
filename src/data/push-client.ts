/** Avisos no celular (Web Push). No iPhone só funciona com o app instalado na Tela de Início (iOS 16.4+). */
import { rpc } from "./real-repository";

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

const isIos = () => typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const standalone = () => typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (isIos() && !standalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub || Notification.permission !== "granted") return "off";
  // "Ligado" só se ESTE aparelho está registrado para a conta que está usando agora.
  try {
    const r = await rpc<{ registered: boolean }>("checkPushSubscription", { endpoint: sub.endpoint });
    return r.registered ? "on" : "off";
  } catch {
    return "off";
  }
}

/** Pede permissão, registra este aparelho e salva no servidor. */
export async function enablePush(): Promise<PushState> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  await rpc("savePushSubscription", { subscription: sub.toJSON(), userAgent: navigator.userAgent });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await rpc("removePushSubscription", { endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  return "off";
}

export type PushTest = { configured: boolean; devices: number; accepted: number };
export const testPush = () => rpc<PushTest>("testPush");

/** Ao sair da conta: desliga os avisos SÓ deste aparelho (os outros aparelhos da pessoa continuam). */
export async function signOutThisDevice() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await rpc("removePushSubscription", { endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  } catch { /* sair nunca trava por causa dos avisos */ }
}
export const setNotifyPrefs = (p: { photo: boolean; letter: boolean; bone: boolean }) => rpc("setNotifyPrefs", p);
export interface Notice { id: string; dogId: string; read: boolean; createdAt: string; text: string; url: string }
export const listNotifications = () => rpc<Notice[]>("listNotifications");
export const markNotificationsRead = (ids: string[]) => rpc("markNotificationsRead", { ids });

/**
 * Ao abrir o app com sessão: se este aparelho estava ligado a OUTRA conta (sessão expirada, troca de
 * conta), o servidor desfaz a ligação antiga. Silencioso; não liga nada sozinho.
 */
export async function syncDeviceOwner() {
  try {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await rpc("checkPushSubscription", { endpoint: sub.endpoint });
  } catch { /* nunca atrapalha a abertura do app */ }
}
