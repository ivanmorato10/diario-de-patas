"use client";

import Link from "next/link";
import { useMemo } from "react";
import { COLLECTIONS } from "@/config/catalog";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { MediaImage } from "@/components/media";
import { collectionMissions } from "@/components/mission-ui";
import { IconAlbum } from "@/components/icons";

export default function Albuns() {
  const { ready, snap, unavailable } = useRequireDiary();
  const stats = useMemo(() => {
    const completed = new Set(snap?.completions.map((c) => c.missionId) ?? []);
    const entriesById = new Map(snap?.entries.map((e) => [e.id, e]) ?? []);
    return COLLECTIONS.map((c) => {
      const links = (snap?.albumEntries ?? []).filter((a) => a.albumId === c.id && entriesById.has(a.entryId));
      const missions = collectionMissions(c.id);
      const coverEntry = links.length ? entriesById.get(links[links.length - 1].entryId) : undefined;
      return { c, photos: links.length, done: missions.filter((m) => completed.has(m.id)).length, total: missions.length, cover: coverEntry?.mediaId };
    });
  }, [snap]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready) return <main className="main"><PageLoading /></main>;
  return (
    <>
      <TopBar title="Álbuns" />
      <main className="main">
        <p className="muted">Cada missão concluída vira uma conquista no álbum. Fotos livres também podem morar aqui.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {stats.map(({ c, photos, done, total, cover }) => (
            <Link key={c.id} href={`/albuns/${c.id}`} className="card card--flush" style={{ display: "flex", flexDirection: "column" }}>
              {cover ? (
                <MediaImage id={cover} alt="" className="photo photo--square" style={{ borderRadius: 0 }} />
              ) : (
                <div className="photo photo--square" style={{ borderRadius: 0, display: "grid", placeItems: "center", color: "var(--sage)", background: "var(--brand-soft)" }} aria-hidden="true"><IconAlbum size={36} /></div>
              )}
              <div className="stack" style={{ padding: 12, gap: 2 }}>
                <strong style={{ fontFamily: "var(--font-heading)" }}>{c.title}</strong>
                <span className="caption">{photos} {photos === 1 ? "foto" : "fotos"}{c.hasMissions ? ` · ${done}/${total} conquistas` : ""}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
