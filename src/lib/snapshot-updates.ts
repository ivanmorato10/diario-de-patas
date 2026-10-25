/**
 * Resultados CONFIRMADOS pelo servidor aplicados ao estado da tela, sem esperar recarregar tudo (a recarga depois
 * só confere). Puras e testadas: a tela não inventa estado, só usa o que o servidor devolveu.
 */
import type { MissionTemplate } from "@/config/catalog";
import type { Snapshot, SubmitResult } from "@/data/demo-repository";
import type { AlbumId, DiaryEntry } from "@/domain/types";

/** Lembrança recém-salva no estado da tela (Diário, álbuns escolhidos), sem esperar recarregar. */
export function withSavedEntry(s: Snapshot, entry: DiaryEntry, albumIds: string[]): Snapshot {
  const entries = [entry, ...s.entries.filter((e) => e.id !== entry.id)]
    .sort((a, b) => b.occurredDate.localeCompare(a.occurredDate) || b.createdAt.localeCompare(a.createdAt));
  const extra = albumIds.filter((a) => !s.albumEntries.some((x) => x.albumId === a && x.entryId === entry.id))
    .map((albumId) => ({ key: `${albumId}:${entry.id}`, albumId: albumId as AlbumId, entryId: entry.id, addedAt: entry.createdAt }));
  return { ...s, entries, albumEntries: [...s.albumEntries, ...extra] };
}

/** Resultado confirmado da missão no estado da tela: conclusão, XP, foto ligada à missão e ao álbum dela. */
export function withSubmitResult(s: Snapshot, entryId: string, mission: MissionTemplate, r: SubmitResult): Snapshot {
  if (!r.completion) return s;
  const dogId = r.completion.dogId;
  const albumId = mission.collectionId;
  const inAlbum = s.albumEntries.some((x) => x.albumId === albumId && x.entryId === entryId);
  return {
    ...s,
    completions: s.completions.some((c) => c.instanceKey === r.completion!.instanceKey) ? s.completions : [...s.completions, r.completion],
    xpTotal: s.xpTotal + r.xpAwarded,
    xpMonth: s.xpMonth + r.xpAwarded,
    entries: s.entries.map((e) => (e.id === entryId ? { ...e, missionId: mission.id } : e)),
    albumEntries: inAlbum ? s.albumEntries : [...s.albumEntries, { key: `${albumId}:${entryId}`, albumId, entryId, addedAt: r.completion.completedAt }],
    medals: [...s.medals, ...r.medals.filter((m) => !s.medals.some((x) => x.setId === m)).map((setId) => ({ key: `${dogId}:${setId}`, dogId, setId, createdAt: r.completion!.completedAt }))],
    collectionAdvances: r.advancedItem && !s.collectionAdvances.some((a) => a.itemId === r.advancedItem)
      ? [...s.collectionAdvances, { key: `${dogId}:${r.advancedItem}`, dogId, itemId: r.advancedItem, entryId, viaMissionId: mission.id, createdAt: r.completion.completedAt }]
      : s.collectionAdvances,
  };
}
