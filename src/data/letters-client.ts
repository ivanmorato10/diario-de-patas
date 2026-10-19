/** Cartinhas, ossinhos e o nome (só com conta). */
import type { Bone, DiaryMember } from "@/domain/types";
import { rpc } from "./real-repository";
import type { loose } from "@/i18n/keys";

export const setMyName = (name: string) => rpc<{ name: string }>("setMyName", { name });
export const saveLetter = (input: { requestKey: string; body: string; date: string }) => rpc<{ id: string }>("saveLetter", input);
export const updateLetter = (input: { id: string; body: string; date: string }) => rpc("updateLetter", input);
export const deleteLetter = (id: string) => rpc("deleteLetter", { id });
export const toggleBone = (targetType: "entry" | "letter", targetId: string) => rpc<{ given: boolean }>("toggleBone", { targetType, targetId });

/**
 * "Bianca deu um ossinho", "Bianca e Duda deram ossinho", "Bianca, Duda e mais 2 deram ossinho".
 * `t`: tradutor com o namespace "bones" (nomes das pessoas nunca são traduzidos).
 */
export function bonesText(bones: Bone[], members: DiaryMember[], meId: string, t: ReturnType<typeof loose>) {
  if (!bones.length) return "";
  const mine = bones.some((b) => b.userId === meId);
  const names = bones.filter((b) => b.userId !== meId).map((b) => members.find((m) => m.userId === b.userId)?.name ?? t("someone"));
  if (mine) names.unshift(t("you"));
  if (names.length === 1) return t(mine ? "youGave" : "one", { who: names[0] });
  if (names.length === 2) return t("two", { a: names[0], b: names[1] });
  return t("many", { a: names[0], b: names[1], n: names.length - 2 });
}
