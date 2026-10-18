/** Família e vários cachorros (só com conta). */
import type { DiaryRole } from "@/domain/types";
import { rpc, setActiveDog } from "./real-repository";

/** Explicação de cada papel (convite e família). */
export const ROLE_HELP: Record<DiaryRole, string> = {
  admin: "Cuida do diário: convida pessoas, muda papéis e pode apagar o diário.",
  editor: "Guarda fotos, escreve cartinhas, faz missões e anota os cuidados junto com você.",
  viewer: "Vê todas as fotos e cartinhas e pode dar ossinho 🦴, mas não guarda fotos nem muda nada.",
};
export const ROLE_PT: Record<DiaryRole, string> = { admin: "Responsável pelo diário", editor: "Pode adicionar momentos", viewer: "Pode acompanhar" };

export const switchDog = async (dogId: string) => { await rpc("switchDog", { dogId }); setActiveDog(dogId); };
export const createInvite = (role: "editor" | "viewer") => rpc<{ code: string; role: DiaryRole; expiresAt: string; dogName: string }>("createInvite", { role });
export const acceptInvite = async (code: string, name?: string) => { const r = await rpc<{ dogId: string }>("acceptInvite", { code, name }); setActiveDog(r.dogId); return r; };
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
