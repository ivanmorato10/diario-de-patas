"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useStore } from "@/data/store";
import { bonesText, toggleBone } from "@/data/letters-client";
import type { Letter } from "@/domain/types";
import { useFormat } from "@/i18n/use-format";
import { loose } from "@/i18n/keys";

/** Ossinho (o "curtir" do app): só aparece com 2+ pessoas no diário; não vale na própria lembrança. */
export function BoneBar({ targetType, targetId, authorId }: { targetType: "entry" | "letter"; targetId: string; authorId: string | null | undefined }) {
  const { snap, reload, patchDog } = useStore();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sending = useRef(false); // toque duplo antes de a tela redesenhar
  const [showWho, setShowWho] = useState(false);
  const t = useTranslations("bones");
  const tl = loose(t);
  const me = snap?.me?.userId;
  if (!snap || !me || (snap.members?.length ?? 0) < 2) return null;
  const bones = (snap.bones ?? []).filter((b) => b.targetType === targetType && b.targetId === targetId);
  const mine = bones.some((b) => b.userId === me);
  const own = !!authorId && authorId === me;
  // Como no Instagram: o ossinho aceso já mostra que você deu; o texto cita só as outras pessoas.
  const text = bonesText(bones.filter((b) => b.userId !== me), snap.members ?? [], me, tl);
  const allWho = bonesText(bones, snap.members ?? [], me, tl);
  if (own && !bones.length) return null;

  /**
   * Na hora o ossinho muda; depois vale o que o SERVIDOR confirmou. Se não gravou, volta ao que era e avisa
   * (antes, uma falha podia deixar um ossinho que não existia).
   */
  async function toggle() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setFailed(false);
    const dogAtStart = snap!.dog?.id;
    const set = (on: boolean) => patchDog(dogAtStart, (s) => {
      const rest = (s.bones ?? []).filter((b) => !(b.targetType === targetType && b.targetId === targetId && b.userId === me));
      return { ...s, bones: on ? [...rest, { targetType, targetId, userId: me! }] : rest };
    });
    set(!mine);
    try {
      const r = await toggleBone(targetType, targetId);
      set(r.given);
      void reload().catch(() => undefined);
    } catch {
      set(mine);
      setFailed(true);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  // Na própria lembrança: osso aceso com o número; tocar mostra quem deu (não dá para dar em si mesmo).
  if (own) {
    return (
      <div className="bone-bar">
        <button type="button" className="bone-btn is-on bone-btn--count" onClick={() => setShowWho((v) => !v)} aria-expanded={showWho} aria-label={t("countLabel", { count: bones.length, who: allWho })}>
          <span aria-hidden="true">🦴</span> {bones.length}
        </button>
        {showWho ? <span className="caption bone-bar__who">{allWho}</span> : null}
      </div>
    );
  }

  return (
    <div className="bone-bar">
      <button type="button" className={`bone-btn${mine ? " is-on" : ""}${bones.length ? " bone-btn--count" : ""}`} onClick={toggle} disabled={busy} aria-pressed={mine} aria-label={mine ? t("remove") : t("give")}>
        <span aria-hidden="true">🦴</span>{bones.length ? ` ${bones.length}` : ""}
      </button>
      {text ? <span className="caption bone-bar__who">{text}</span> : null}
      {failed ? <span className="field-error bone-bar__error" role="alert">{t("failed")}</span> : null}
    </div>
  );
}

/** Cartinha no Diário: papel de carta (quem fala é a pessoa, não o Abu: sem patinha). */
export function LetterCard({ letter, dogName }: { letter: Letter; dogName: string }) {
  const { snap } = useStore();
  const canEdit = snap?.role !== "viewer" && (letter.mine || snap?.role === "admin");
  const t = useTranslations("letter");
  const f = useFormat();
  const author = letter.createdByName ?? t("someone");
  return (
    <article id={`carta-${letter.id}`} className="letter-card" style={{ margin: "6px 4px 14px" }}>
      <p className="letter-card__kicker">{letter.mine ? t("kickerMine") : t("kickerFrom", { author })}</p>
      <p className="letter-card__hello">{t("hello", { dog: dogName })}</p>
      <p className="letter-card__body">{letter.body}</p>
      <p className="letter-card__sign">— {letter.mine ? (snap?.me?.name ?? t("you")) : author}</p>
      <div className="row-between" style={{ marginTop: 8 }}>
        <p className="caption" style={{ margin: 0 }}>{f.date(letter.date)}</p>
        {canEdit ? <Link href={`/diario/cartinha?id=${letter.id}`} className="btn btn--ghost btn--small">{t("edit")}</Link> : null}
      </div>
      <BoneBar targetType="letter" targetId={letter.id} authorId={letter.createdBy} />
    </article>
  );
}
