/** Cartinhas, ossinhos e o nome (só com conta). */
import type { Bone, DiaryMember } from "@/domain/types";
import { rpc } from "./real-repository";

export const setMyName = (name: string) => rpc<{ name: string }>("setMyName", { name });
export const saveLetter = (input: { requestKey: string; body: string; date: string }) => rpc<{ id: string }>("saveLetter", input);
export const updateLetter = (input: { id: string; body: string; date: string }) => rpc("updateLetter", input);
export const deleteLetter = (id: string) => rpc("deleteLetter", { id });
export const toggleBone = (targetType: "entry" | "letter", targetId: string) => rpc<{ given: boolean }>("toggleBone", { targetType, targetId });

/** "Bianca deu um ossinho", "Bianca e Duda deram ossinho", "Bianca, Duda e mais 2 deram ossinho". */
export function bonesText(bones: Bone[], members: DiaryMember[], meId: string) {
  if (!bones.length) return "";
  const names = bones.map((b) => (b.userId === meId ? "Você" : members.find((m) => m.userId === b.userId)?.name ?? "Alguém da família"));
  names.sort((a, b) => (a === "Você" ? -1 : b === "Você" ? 1 : 0));
  const who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} e ${names[1]}` : `${names[0]}, ${names[1]} e mais ${names.length - 2}`;
  return `${who} ${names.length === 1 ? (names[0] === "Você" ? "deu um ossinho" : "deu um ossinho") : "deram ossinho"}`;
}
