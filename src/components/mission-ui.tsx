"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { MISSIONS, type MissionTemplate } from "@/config/catalog";
import type { MissionState } from "@/domain/missions";
import { useCatalog } from "@/i18n/catalog";
import { useStore } from "@/data/store";
import { IconCheck, IconChevron, IconLock, IconStar } from "./icons";

export function collectionMissions(id: string) {
  return MISSIONS.filter((m) => m.collectionId === id);
}

/** Figurinha da missão. No álbum (`slot`), o que ainda não foi conquistado aparece como espaço vazio. */
export function MissionStamp({ state, slot = false }: { state: MissionState; slot?: boolean }) {
  const cls = state === "completed" ? "mission-stamp mission-stamp--done" : state === "locked" || slot ? "mission-stamp mission-stamp--locked" : "mission-stamp";
  const Icon = state === "completed" ? IconCheck : state === "locked" ? IconLock : IconStar;
  return <span className={cls} aria-hidden="true"><Icon /></span>;
}

export function MissionRow({ m, state }: { m: MissionTemplate; state: MissionState }) {
  const t = useTranslations("missions");
  const cat = useCatalog(useStore().snap?.dog?.name ?? "");
  return (
    <Link href={`/missoes/${m.slug}`} className="card mission-card" style={{ padding: 14 }}>
      <MissionStamp state={state} />
      <span className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <strong>{cat.title(m)}</strong>
        <span className="caption">{cat.collection(m.collectionId).title} · {t(`state.${state}`)}</span>
      </span>
      <span className="chip chip--reward">+{m.xp} 🐾</span>
      <IconChevron size={18} className="muted" />
    </Link>
  );
}
