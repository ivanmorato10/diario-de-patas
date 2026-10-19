"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { DiaryEntry } from "@/domain/types";
import { useFormat } from "@/i18n/use-format";
import { MediaImage } from "./media";

const EVERY_MS = 10_000;
const MAX = 12;

/**
 * Lembranças do Hoje: passa pelas fotos mais recentes do diário, uma a cada 10 s (com um fade).
 * Para quem prefere menos movimento (prefers-reduced-motion), fica na última foto.
 * A foto aparece inteira, sem corte.
 */
export function MemoryRotator({ entries, dogName }: { entries: DiaryEntry[]; dogName: string }) {
  const list = entries.slice(0, MAX);
  const [i, setI] = useState(0);
  const t = useTranslations("memory");
  const f = useFormat();
  useEffect(() => {
    if (list.length < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setI((x) => (x + 1) % list.length);
    }, EVERY_MS);
    return () => clearInterval(t);
  }, [list.length]);

  const e = list[i % Math.max(1, list.length)];
  if (!e) return null;
  const next = list[(i + 1) % list.length];
  return (
    <Link href={`/diario#${e.id}`} className="polaroid tape hoje-memory__photo" style={{ display: "block", textDecoration: "none" }} aria-label={t("label", { dog: dogName, what: e.caption || f.date(e.occurredDate) })}>
      <div className="memory-fade" key={e.id}>
        <MediaImage id={e.mediaId} variant="display" alt={e.caption ? t("altCaption", { caption: e.caption }) : t("alt", { dog: dogName })} className="photo photo--natural" />
        <p className="polaroid__note">{e.caption || dogName}</p>
        <p className="caption polaroid__meta">{i === 0 ? t("latest") : t("one")} · {f.date(e.occurredDate)}</p>
      </div>
      {/* Carrega a próxima por trás, para a troca não piscar. */}
      {next && next.id !== e.id ? <span hidden><MediaImage id={next.mediaId} variant="display" alt="" className="photo" /></span> : null}
    </Link>
  );
}
