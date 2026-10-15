"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { COLLECTIONS } from "@/config/catalog";
import { useAlbumTitle } from "@/components/album-picker";
import { LIMITS } from "@/config/business";
import { formatCivilDate, formatMonthKey, monthKey } from "@/domain/dates";
import { missionById } from "@/domain/missions";
import type { DiaryEntry, Letter } from "@/domain/types";
import { REAL_MODE } from "@/config/mode";
import { BoneBar, LetterCard } from "@/components/letters";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { MediaImage } from "@/components/media";
import { AbuSays } from "@/components/brand";
import { EntryActions, UseInMission } from "@/components/entry-actions";
import { cycleContext } from "@/data/store";
import { IconPlus, IconStar } from "@/components/icons";

type Filter = string; // "all" | "mission" | "free" | "studio" | "letters" | id de álbum
type Item = { kind: "entry"; e: DiaryEntry; date: string; at: string } | { kind: "letter"; l: Letter; date: string; at: string };

export default function Diario() {
  const { ready, snap, unavailable } = useRequireDiary();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const ctx = useMemo(() => (snap ? cycleContext(snap) : null), [snap]);
  const albumTitle = useAlbumTitle();

  const albumsByEntry = useMemo(() => {
    const map = new Map<string, string[]>();
    snap?.albumEntries.forEach((a) => map.set(a.entryId, [...(map.get(a.entryId) ?? []), a.albumId]));
    return map;
  }, [snap]);

  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    const photos: Item[] = filter === "letters" ? [] : (snap?.entries ?? []).filter((e) => {
      if (q && !e.caption.toLocaleLowerCase("pt-BR").includes(q)) return false;
      if (filter === "all") return true;
      if (filter === "mission" || filter === "free" || filter === "studio") return e.source === filter;
      return albumsByEntry.get(e.id)?.includes(filter) ?? false;
    }).map((e) => ({ kind: "entry", e, date: e.occurredDate, at: e.createdAt }));
    // Cartinhas entram na linha do tempo, na data delas (em "Tudo" e em "Cartinhas").
    const letters: Item[] = filter === "all" || filter === "letters"
      ? (snap?.letters ?? []).filter((l) => !q || l.body.toLocaleLowerCase("pt-BR").includes(q)).map((l) => ({ kind: "letter", l, date: l.date, at: l.createdAt }))
      : [];
    const list = [...photos, ...letters].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
    const out: [string, Item[]][] = [];
    for (const it of list) {
      const k = monthKey(it.date);
      const last = out[out.length - 1];
      if (last && last[0] === k) last[1].push(it);
      else out.push([k, [it]]);
    }
    return out;
  }, [snap, filter, query, albumsByEntry]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;
  const dog = snap.dog;
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "Tudo" }, ...(snap.letters?.length ? [{ id: "letters" as Filter, label: "💌 Cartinhas" }] : []), { id: "mission", label: "Missões" }, { id: "free", label: "Livres" },
    ...COLLECTIONS.map((c) => ({ id: c.id as Filter, label: c.title })),
    ...snap.customAlbums.map((a) => ({ id: a.id as Filter, label: a.title })),
  ];

  return (
    <>
      <TopBar title="Diário" />
      <main className="main">
        {snap.entries.length === 0 && !snap.letters?.length ? (
          <div className="stack-lg">
            <AbuSays>Uma soneca também é uma grande conquista. Que tal guardar o primeiro momento?</AbuSays>
            <div className="card stitched empty" style={{ boxShadow: "none" }}>
              <h2>O diário de {dog.name} está em branco</h2>
              <p className="page-note">Toque em “Guardar momento” e escolha uma foto — pode ser antiga.</p>
              <Link href="/guardar" className="btn btn--primary"><IconPlus /> Guardar momento</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="stack">
              <div className="field">
                <label htmlFor="busca" className="sr-only">Buscar nas legendas</label>
                <input id="busca" type="search" className="input" placeholder="Buscar nas legendas" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div role="group" aria-label="Filtrar lembranças" className="filter-row">
                {filters.map((f) => (
                  <button key={f.id} type="button" className={`filter-chip${filter === f.id ? " is-active" : ""}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {groups.length === 0 ? <p className="muted">Nada encontrado com esse filtro.</p> : null}

            {groups.map(([k, list]) => (
              <section key={k} aria-labelledby={`m-${k}`} className="stack">
                <h2 id={`m-${k}`} className="timeline-month">{formatMonthKey(k)}</h2>
                {list.map((it) => {
                  if (it.kind === "letter") return <LetterCard key={it.l.id} letter={it.l} dogName={dog.name} />;
                  const e = it.e;
                  const m = e.missionId ? missionById(e.missionId) : null;
                  const label = e.caption ? `lembrança “${e.caption.slice(0, 40)}”` : `lembrança de ${formatCivilDate(e.occurredDate)}`;
                  return (
                    <article key={e.id} id={e.id} className="polaroid" style={{ margin: "6px 4px 14px" }}>
                      <MediaImage id={e.mediaId} variant="display" alt={e.caption ? `Foto: ${e.caption}` : `Foto de ${dog.name}`} className="photo photo--natural" />
                      {e.caption ? <p className="polaroid__note">{e.caption}</p> : null}
                      <div className="stack" style={{ padding: "8px 4px 6px", gap: 6 }}>
                        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                          {m ? <span className="chip chip--reward"><IconStar size={14} /> {m.title}</span> : null}
                          {e.source === "studio" ? <span className="chip chip--accent">🎨 Arte do Estúdio</span> : null}
                          {(albumsByEntry.get(e.id) ?? []).map((a) => <span key={a} className="chip chip--neutral">{albumTitle(a)}</span>)}
                        </div>
                        <div className="row-between">
                          <p className="caption">{formatCivilDate(e.occurredDate)}{e.createdByName ? ` · guardada por ${e.createdByName}` : ""}</p>
                          <EntryActions entry={e} albumIds={albumsByEntry.get(e.id) ?? []} today={snap.today} label={label} />
                        </div>
                        {ctx && snap.role !== "viewer" ? <UseInMission entry={e} ctx={ctx} label={label} /> : null}
                        <BoneBar targetType="entry" targetId={e.id} authorId={e.createdBy} />
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}
          </>
        )}
        <div className="sticky-action">
          {REAL_MODE && snap.role !== "viewer" ? (
            <div className="sticky-action__pair">
              <Link href="/guardar" className="btn btn--primary">Guardar momento</Link>
              <Link href="/diario/cartinha" className="btn btn--primary">Escrever cartinha</Link>
            </div>
          ) : (
            <Link href="/guardar" className="btn btn--primary"><IconPlus /> Guardar momento</Link>
          )}
        </div>
      </main>
    </>
  );
}
