/** Família e vários cachorros (só com conta). */
import type { DiaryRole } from "@/domain/types";
import { rpc } from "./real-repository";

export const ROLE_PT: Record<DiaryRole, string> = { admin: "Administrador", editor: "Pode editar", viewer: "Só ver" };

export const switchDog = (dogId: string) => rpc("switchDog", { dogId });
export const createInvite = (role: "editor" | "viewer") => rpc<{ code: string; role: DiaryRole; expiresAt: string; dogName: string }>("createInvite", { role });
export const acceptInvite = (code: string, name?: string) => rpc<{ dogId: string }>("acceptInvite", { code, name });
export const updateMember = (userId: string, role: DiaryRole) => rpc("updateMember", { userId, role });
export const removeMember = (userId: string) => rpc("removeMember", { userId });

/** Confere o formato antes de ir ao servidor; devolve a mensagem de erro ou null. */
export function inviteFormatError(code: string) {
  const n = code.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^PATA/, "");
  if (!n) return "Digite o código que você recebeu.";
  if (n.length !== 8) return "Esse código não está completo. Ele tem este formato: PATA-XXXX-XXXX.";
  return null;
}

/** Prévia pública do convite (funciona antes de entrar na conta). */
export async function previewInvite(code: string): Promise<{ dogName: string; invitedBy: string; role: DiaryRole }> {
  const res = await fetch("/api/convite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message ?? "Convite inválido.");
  return json;
}
