"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCatalog } from "@/i18n/catalog";
import { useFormat, usePrefs } from "@/i18n/use-format";
import { COLLECTIONS } from "@/config/catalog";
import { useAlbumTitle, useCustomAlbumTitle } from "@/components/album-picker";
import { LIMITS } from "@/config/business";
import { monthKey } from "@/domain/dates";
import { missionById } from "@/domain/missions";
import type { DiaryEntry, Letter } from "@/domain/types";
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
  const { region } = usePrefs();
  const ctx = useMemo(() => (snap ? cycleContext(snap, region) : null), [snap, region]);
  const albumTitle = useAlbumTitle();
  const customTitle = useCustomAlbumTitle();
  const t = useTranslations("diary");
  const cat = useCatalog(snap?.dog?.name ?? "");
  const f = useFormat();
  const locale = useLocale();

  const albumsByEntry = useMemo(() => {
    const map = new Map<string, string[]>();
    snap?.albumEntries.forEach((a) => map.set(a.entryId, [...(map.get(a.entryId) ?? []), a.albumId]));
    return map;
  }, [snap]);

  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    const photos: Item[] = filter === "letters" ? [] : (snap?.entries ?? []).filter((e) => {
      if (q && !e.caption.toLocaleLowerCase(locale).includes(q)) return false;
      if (filter === "all") return true;
      if (filter === "mission" || filter === "free" || filter === "studio") return e.source === filter;
      return albumsByEntry.get(e.id)?.includes(filter) ?? false;
    }).map((e) => ({ kind: "entry", e, date: e.occurredDate, at: e.createdAt }));
    // Cartinhas entram na linha do tempo, na data delas (em "Tudo" e em "Cartinhas").
    const letters: Item[] = filter === "all" || filter === "letters"
      ? (snap?.letters ?? []).filter((l) => !q || l.body.toLocaleLowerCase(locale).includes(q)).map((l) => ({ kind: "letter", l, date: l.date, at: l.createdAt }))
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
  }, [snap, filter, query, albumsByEntry, locale]);

  // Ir até uma lembrança (aviso, "Ver no diário"): ?ir=<id> ou #<id>. Tira filtros que a esconderiam,
  // rola com folga para o topo fixo e SEGURA a posição enquanto as fotos de cima carregam e mudam de
  // altura (até a página estabilizar ou a pessoa rolar). Destaca a lembrança por um instante.
  const target = useRef<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("ir");
    target.current = p || (window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : null);
    if (target.current) { setFilter("all"); setQuery(""); }
  }, []);
  useEffect(() => {
    const id = target.current;
    if (!id || !snap?.dog) return;
    let stopped = false, still = 0, lastTop = NaN;
    const started = performance.now();
    const stop = () => { stopped = true; };
    window.addEventListener("wheel", stop, { once: true, passive: true });
    window.addEventListener("touchmove", stop, { once: true, passive: true });
    window.addEventListener("keydown", stop, { once: true });
    // Ainda carregando ACIMA da lembrança? (imagens não terminadas ou espaços reservados)
    const pendingAbove = (el: HTMLElement) => {
      const top = el.getBoundingClientRect().top;
      const imgs = Array.from(document.querySelectorAll("main img")) as HTMLImageElement[];
      const waiting = imgs.some((im) => !im.complete && im.getBoundingClientRect().top < top);
      const placeholders = Array.from(document.querySelectorAll("main .skeleton")).some((p) => p.getBoundingClientRect().top < top);
      return waiting || placeholders;
    };
    const tick = () => {
      if (stopped || performance.now() - started > 15_000) return;
      const el = document.getElementById(id);
      if (el) {
        const top = el.getBoundingClientRect().top;
        if (Math.abs(top - 76) > 2) window.scrollBy({ top: top - 76 });
        el.classList.add("is-target");
        // Estável = nada carregando acima E a posição parada por ~0,5 s.
        still = !pendingAbove(el) && Math.abs(top - lastTop) < 1 ? still + 1 : 0;
        lastTop = top;
        if (still > 30) { target.current = null; setTimeout(() => el.classList.remove("is-target"), 1600); return; }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { stopped = true; window.removeEventListener("wheel", stop); window.removeEventListener("touchmove", stop); window.removeEventListener("keydown", stop); };
  }, [snap]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;
  const dog = snap.dog;
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t("filters.all") }, ...(snap.letters?.length ? [{ id: "letters" as Filter, label: t("filters.letters") }] : []), { id: "mission", label: t("filters.mission") }, { id: "free", label: t("filters.free") },
    ...COLLECTIONS.map((c) => ({ id: c.id as Filter, label: cat.collection(c.id).title })),
    ...snap.customAlbums.map((a) => ({ id: a.id as Filter, label: customTitle(a) })),
  ];

  return (
    <>
      <TopBar title={t("title")} emoji="📖" />
      <main className="main">
        {snap.entries.length === 0 && !snap.letters?.length ? (
          <div className="stack-lg">
            <AbuSays>{t("emptyAbu")}</AbuSays>
            <div className="card stitched empty" style={{ boxShadow: "none" }}>
              <h2>{t("emptyTitle", { dog: dog.name })}</h2>
              <p className="page-note">{t("emptyText")}</p>
              <Link href="/guardar" className="btn btn--primary"><IconPlus /> {t("saveMoment")}</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="stack">
              <div className="field">
                <label htmlFor="busca" className="sr-only">{t("search")}</label>
                <input id="busca" type="search" className="input" placeholder={t("search")} value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div role="group" aria-label={t("filterLabel")} className="filter-row">
                {filters.map((f) => (
                  <button key={f.id} type="button" className={`filter-chip${filter === f.id ? " is-active" : ""}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {groups.length === 0 ? <p className="muted">{t("nothing")}</p> : null}

            {groups.map(([k, list]) => (
              <section key={k} aria-labelledby={`m-${k}`} className="stack">
                <h2 id={`m-${k}`} className="timeline-month">{f.month(k)}</h2>
                {list.map((it) => {
                  if (it.kind === "letter") return <LetterCard key={it.l.id} letter={it.l} dogName={dog.name} />;
                  const e = it.e;
                  const m = e.missionId ? missionById(e.missionId) : null;
                  const label = e.caption ? t("labelCaption", { caption: e.caption.slice(0, 40) }) : t("labelDate", { date: f.date(e.occurredDate) });
                  return (
                    <article key={e.id} id={e.id} className="polaroid" style={{ margin: "6px 4px 14px" }}>
                      <MediaImage id={e.mediaId} variant="display" alt={e.caption ? t("photoCaption", { caption: e.caption }) : t("photoOf", { dog: dog.name })} className="photo photo--natural" />
                      {e.caption ? <p className="polaroid__note">{e.caption}</p> : null}
                      <div className="stack" style={{ padding: "8px 4px 6px", gap: 6 }}>
                        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                          {m ? <span className="chip chip--reward"><IconStar size={14} /> {cat.title(m)}</span> : null}
                          {e.source === "studio" ? <span className="chip chip--accent">{t("studioArt")}</span> : null}
                          {(albumsByEntry.get(e.id) ?? []).map((a) => <span key={a} className="chip chip--neutral">{albumTitle(a)}</span>)}
                        </div>
                        <div className="row-between">
                          <p className="caption">{f.date(e.occurredDate)}{e.createdByName ? ` · ${t("savedBy", { name: e.createdByName })}` : ""}</p>
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
          {snap.role !== "viewer" ? (
            <div className="sticky-action__pair">
              <Link href="/guardar" className="btn btn--primary">{t("saveMoment")}</Link>
              <Link href="/diario/cartinha" className="btn btn--primary">{t("writeLetter")}</Link>
            </div>
          ) : (
            <Link href="/guardar" className="btn btn--primary"><IconPlus /> {t("saveMoment")}</Link>
          )}
        </div>
      </main>
    </>
  );
}
