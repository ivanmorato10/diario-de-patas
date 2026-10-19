/**
 * Textos do catálogo (missões, coleções, níveis) a partir dos arquivos de idioma, com {dog} explícito.
 * Nada de troca automática de palavras: cada frase já diz onde entra o nome do cachorro.
 */
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { CollectionId, MissionTemplate } from "@/config/catalog";
import type { DailySlot, PermanentSetId } from "@/config/cycle";
import { roman, type LevelInfo } from "@/domain/missions";
import { loose } from "./keys";

type Loose = ReturnType<typeof loose>;

export interface MissionText { title: string; description: string; criterion: string; homeAlternative: string | null }

/** `t` sem namespace ou com o namespace "catalog" (prefixo `p`). Serve para tela e servidor. */
export function missionText(t: Loose, m: Pick<MissionTemplate, "id"> | string, dog: string, p = "catalog."): MissionText {
  const id = typeof m === "string" ? m : m.id;
  const alt = `${p}missions.${id}.homeAlternative`;
  return {
    title: t(`${p}missions.${id}.title`, { dog }),
    description: t(`${p}missions.${id}.description`, { dog }),
    criterion: t(`${p}missions.${id}.criterion`, { dog }),
    homeAlternative: t.has(alt) ? t(alt, { dog }) : null,
  };
}

export function levelName(t: Loose, l: { level: number; endless: number }, p = "catalog."): string {
  const name = t(`${p}levels.l${l.level}`);
  return l.endless ? `${name} ${roman(l.endless + 1)}` : name;
}

/** Atalhos de catálogo para as telas. `dog` é o nome do cachorro do diário aberto. */
export function useCatalog(dog: string) {
  const t = loose(useTranslations());
  return useMemo(() => ({
    mission: (m: Pick<MissionTemplate, "id"> | string) => missionText(t, m, dog),
    title: (m: Pick<MissionTemplate, "id"> | string) => t(`catalog.missions.${typeof m === "string" ? m : m.id}.title`, { dog }),
    collection: (id: CollectionId) => ({ title: t(`catalog.collections.${id}.title`), description: t(`catalog.collections.${id}.description`) }),
    set: (id: PermanentSetId) => ({ title: t(`catalog.sets.${id}.title`), note: t.has(`catalog.sets.${id}.note`) ? t(`catalog.sets.${id}.note`) : null }),
    slot: (id: DailySlot) => t(`catalog.slots.${id}`),
    level: (l: LevelInfo) => levelName(t, l),
    nextLevel: (l: LevelInfo) => (l.next ? levelName(t, l.next) : null),
  }), [t, dog]);
}
