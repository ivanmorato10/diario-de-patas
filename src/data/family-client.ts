/** Família e vários cachorros (só com conta). */
import type { DiaryRole } from "@/domain/types";
import { rpc, setActiveDog } from "./real-repository";

/* Nome e explicação de cada papel: family.roles.<papel> e family.roleHelp.<papel> nos arquivos de idioma. */

export const switchDog = async (dogId: string) => { await rpc("switchDog", { dogId }); setActiveDog(dogId); };
/**
 * Troca de cachorro sem esperar duas viagens: grava a escolha e carrega o diário novo AO MESMO TEMPO (o carregamento
 * já vai com o cachorro novo no cabeçalho, conferido no servidor). Se a gravação falhar, volta para o anterior.
 */
export async function switchDogAndLoad(dogId: string, previous: string | null, reload: () => Promise<void>) {
  setActiveDog(dogId);
  const [saved, loaded] = await Promise.allSettled([rpc("switchDog", { dogId }), reload()]);
  if (saved.status === "rejected") {
    setActiveDog(previous);
    await reload().catch(() => undefined);
    throw saved.reason;
  }
  if (loaded.status === "rejected") throw Object.assign(new Error("reload"), { switched: true });
}
export const createInvite = (role: "editor" | "viewer") => rpc<{ code: string; role: DiaryRole; expiresAt: string; dogName: string }>("createInvite", { role });
export const acceptInvite = async (code: string, name?: string) => { const r = await rpc<{ dogId: string }>("acceptInvite", { code, name }); setActiveDog(r.dogId); return r; };
export const updateMember = (userId: string, role: DiaryRole) => rpc("updateMember", { userId, role });
export const removeMember = (userId: string) => rpc("removeMember", { userId });

/** Confere o formato antes de ir ao servidor; devolve a chave do erro ou null. */
export function inviteFormatError(code: string) {
  const n = code.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^PATA/, "");
  if (!n) return "family.errors.typeCode";
  if (n.length !== 8) return "family.errors.incomplete";
  return null;
}

/** Prévia pública do convite (funciona antes de entrar na conta). */
export async function previewInvite(code: string): Promise<{ dogName: string; invitedBy: string; role: DiaryRole }> {
  const res = await fetch("/api/convite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message ?? "family.errors.invalid");
  return json;
}
