"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/data/store";
import { bonesText, toggleBone } from "@/data/letters-client";
import type { Letter } from "@/domain/types";
import { formatCivilDate } from "@/domain/dates";

/** Ossinho (o "curtir" do app): só aparece com 2+ pessoas no diário; não vale na própria lembrança. */
export function BoneBar({ targetType, targetId, authorId }: { targetType: "entry" | "letter"; targetId: string; authorId: string | null | undefined }) {
  const { snap, reload, patchSnap } = useStore();
  const [busy, setBusy] = useState(false);
  const me = snap?.me?.userId;
  if (!snap || !me || (snap.members?.length ?? 0) < 2) return null;
  const bones = (snap.bones ?? []).filter((b) => b.targetType === targetType && b.targetId === targetId);
  const mine = bones.some((b) => b.userId === me);
  const own = !!authorId && authorId === me;
  const text = bonesText(bones, snap.members ?? [], me);
  if (own && !bones.length) return null;

  async function toggle() {
    setBusy(true);
    // Na hora: o ossinho aparece antes da resposta do servidor (o reload confirma).
    patchSnap((s) => ({ ...s, bones: mine ? (s.bones ?? []).filter((b) => !(b.targetType === targetType && b.targetId === targetId && b.userId === me)) : [...(s.bones ?? []), { targetType, targetId, userId: me! }] }));
    try { await toggleBone(targetType, targetId); } finally { await reload().catch(() => undefined); setBusy(false); }
  }

  return (
    <div className="bone-bar">
      {!own ? (
        <button type="button" className={`bone-btn${mine ? " is-on" : ""}`} onClick={toggle} disabled={busy} aria-pressed={mine}>
          <span aria-hidden="true">🦴</span> {mine ? "Ossinho dado" : "Dar ossinho"}
        </button>
      ) : null}
      {text ? <span className="caption bone-bar__who">🦴 {text}</span> : null}
    </div>
  );
}

/** Cartinha no Diário: papel de carta (quem fala é a pessoa, não o Abu: sem patinha). */
export function LetterCard({ letter, dogName }: { letter: Letter; dogName: string }) {
  const { snap } = useStore();
  const canEdit = snap?.role !== "viewer" && (letter.mine || snap?.role === "admin");
  const author = letter.mine ? "Você" : letter.createdByName ?? "Alguém da família";
  return (
    <article id={`carta-${letter.id}`} className="letter-card" style={{ margin: "6px 4px 14px" }}>
      <p className="letter-card__kicker">💌 Cartinha {letter.mine ? "sua" : `de ${author}`}</p>
      <p className="letter-card__hello">Querido {dogName},</p>
      <p className="letter-card__body">{letter.body}</p>
      <p className="letter-card__sign">— {letter.mine ? (snap?.me?.name ?? "Você") : author}</p>
      <div className="row-between" style={{ marginTop: 8 }}>
        <p className="caption" style={{ margin: 0 }}>{formatCivilDate(letter.date)}</p>
        {canEdit ? <Link href={`/diario/cartinha?id=${letter.id}`} className="btn btn--ghost btn--small">Editar</Link> : null}
      </div>
      <BoneBar targetType="letter" targetId={letter.id} authorId={letter.createdBy} />
    </article>
  );
}
