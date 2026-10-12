"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { COLLECTIONS, type CollectionId } from "@/config/catalog";
import { LIMITS } from "@/config/business";
import { formatCivilDate, formatMonthKey, monthKey } from "@/domain/dates";
import { missionById } from "@/domain/missions";
import type { DiaryEntry } from "@/domain/types";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { MediaImage } from "@/components/media";
import { AbuSays } from "@/components/brand";
import { EntryActions } from "@/components/entry-actions";
import { IconPlus, IconStar } from "@/components/icons";

type Filter = "all" | "mission" | "free" | "studio" | CollectionId;

export default function Diario() {
  const { ready, snap, unavailable } = useRequireDiary();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const albumsByEntry = useMemo(() => {
    const map = new Map<string, CollectionId[]>();
    snap?.albumEntries.forEach((a) => map.set(a.entryId, [...(map.get(a.entryId) ?? []), a.albumId]));
    return map;
  }, [snap]);

  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    const list = (snap?.entries ?? []).filter((e) => {
      if (q && !e.caption.toLocaleLowerCase("pt-BR").includes(q)) return false;
      if (filter === "all") return true;
      if (filter === "mission" || filter === "free" || filter === "studio") return e.source === filter;
      return albumsByEntry.get(e.id)?.includes(filter) ?? false;
    });
    const out: [string, DiaryEntry[]][] = [];
    for (const e of list) {
      const k = monthKey(e.occurredDate);
      const last = out[out.length - 1];
      if (last && last[0] === k) last[1].push(e);
      else out.push([k, [e]]);
    }
    return out;
  }, [snap, filter, query, albumsByEntry]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;
  const dog = snap.dog;
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "Tudo" }, { id: "mission", label: "Missões" }, { id: "free", label: "Livres" },
    ...COLLECTIONS.map((c) => ({ id: c.id as Filter, label: c.title })),
  ];

  return (
    <>
      <TopBar title="Diário" />
      <main className="main">
        {snap.entries.length === 0 ? (
          <div className="stack-lg">
            <AbuSays>Uma soneca também é uma grande conquista. Que tal guardar o primeiro momento?</AbuSays>
            <div className="card stitched empty" style={{ boxShadow: "none" }}>
              <h2>O diário de {dog.name} está em branco</h2>
              <p className="muted">Toque em “Guardar momento” e escolha uma foto — pode ser antiga.</p>
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
              <div role="group" aria-label="Filtrar lembranças" className="row" style={{ overflowX: "auto", gap: 8, paddingBottom: 4, flexWrap: "nowrap" }}>
                {filters.map((f) => (
                  <button key={f.id} type="button" className={`chip ${filter === f.id ? "" : "chip--outline"}`} style={{ minHeight: 36, border: filter === f.id ? "1px solid var(--brand-primary)" : undefined, cursor: "pointer", whiteSpace: "nowrap" }} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="caption" aria-live="polite">{groups.reduce((s, [, l]) => s + l.length, 0)} de {snap.entries.length} lembranças · limite desta versão: {LIMITS.maxEntries}</p>
            </div>

            {groups.length === 0 ? <p className="muted">Nada encontrado com esse filtro.</p> : null}

            {groups.map(([k, list]) => (
              <section key={k} aria-labelledby={`m-${k}`} className="stack">
                <h2 id={`m-${k}`} className="timeline-month">{formatMonthKey(k)}</h2>
                {list.map((e) => {
                  const m = e.missionId ? missionById(e.missionId) : null;
                  const label = e.caption ? `lembrança “${e.caption.slice(0, 40)}”` : `lembrança de ${formatCivilDate(e.occurredDate)}`;
                  return (
                    <article key={e.id} id={e.id} className="polaroid" style={{ margin: "6px 4px 14px" }}>
                      <MediaImage id={e.mediaId} variant="display" alt={e.caption ? `Foto: ${e.caption}` : `Foto de ${dog.name}`} className="photo" />
                      {e.caption ? <p className="polaroid__note">{e.caption}</p> : null}
                      <div className="stack" style={{ padding: "8px 4px 6px", gap: 6 }}>
                        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                          {m ? <span className="chip chip--reward"><IconStar size={14} /> {m.title}</span> : null}
                          {e.source === "studio" ? <span className="chip chip--accent">Arte criada com IA</span> : null}
                          {(albumsByEntry.get(e.id) ?? []).map((a) => <span key={a} className="chip chip--neutral">{COLLECTIONS.find((c) => c.id === a)?.title}</span>)}
                        </div>
                        <div className="row-between">
                          <p className="caption">{formatCivilDate(e.occurredDate)}</p>
                          <EntryActions entry={e} albumIds={albumsByEntry.get(e.id) ?? []} today={snap.today} label={label} />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}
          </>
        )}
        <div className="sticky-action">
          <Link href="/guardar" className="btn btn--primary"><IconPlus /> Guardar momento</Link>
        </div>
      </main>
    </>
  );
}
