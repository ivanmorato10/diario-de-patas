"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { LIMITS } from "@/config/business";
import { useStore } from "@/data/store";
import { DomainError } from "@/data/demo-repository";
import { FormSheet, Field } from "@/components/care-forms";
import { IconPlus } from "@/components/icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CollectionsView } from "@/components/collections";
import { COLLECTIONS } from "@/config/catalog";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { MediaImage } from "@/components/media";
import { collectionMissions } from "@/components/mission-ui";
import { IconAlbum } from "@/components/icons";

export default function AlbunsPage() {
  return (
    <Suspense fallback={<main className="main"><PageLoading /></main>}>
      <Albuns />
    </Suspense>
  );
}

type Tab = "albuns" | "colecoes";

function Albuns() {
  const { ready, snap, unavailable } = useRequireDiary();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const tab: Tab = params.get("aba") === "colecoes" ? "colecoes" : "albuns";
  const setTab = (t: Tab) => router.replace(t === "colecoes" ? `${path}?aba=colecoes` : path, { scroll: false });
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
  const custom = useMemo(() => {
    const entriesById = new Map(snap?.entries.map((e) => [e.id, e]) ?? []);
    return (snap?.customAlbums ?? []).map((a) => {
      const links = (snap?.albumEntries ?? []).filter((x) => x.albumId === a.id && entriesById.has(x.entryId));
      return { a, photos: links.length, cover: links.length ? entriesById.get(links[links.length - 1].entryId)?.mediaId : undefined };
    });
  }, [snap]);
  const { repo, reload } = useStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!repo || busy) return;
    setBusy(true);
    setError(null);
    try {
      const album = await repo.createAlbum(name);
      await reload();
      setCreating(false);
      setName("");
      router.push(`/albuns/${album.id}`);
    } catch (e) {
      setError(e instanceof DomainError ? e.message : "Não conseguimos criar o álbum. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap) return <main className="main"><PageLoading /></main>;
  return (
    <>
      <TopBar title="Álbuns" />
      <main className="main">
        <div role="tablist" aria-label="Álbuns e coleções" className="tabs">
          {([["albuns", "Álbuns"], ["colecoes", `Coleções (${snap.medals.length}/5)`]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className={`tab${tab === id ? " is-active" : ""}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {tab === "colecoes" ? (
          <div role="tabpanel" id="panel-colecoes" aria-labelledby="tab-colecoes"><CollectionsView snap={snap} /></div>
        ) : (
        <div role="tabpanel" id="panel-albuns" aria-labelledby="tab-albuns" className="stack">
        <p className="muted">Cada missão concluída vira uma conquista no álbum. Fotos livres também podem morar aqui — e você pode criar álbuns com o nome que quiser.</p>
        <button type="button" className="btn btn--secondary" style={{ alignSelf: "flex-start" }} onClick={() => { setError(null); setCreating(true); }} disabled={(snap.customAlbums?.length ?? 0) >= LIMITS.maxCustomAlbums}>
          <IconPlus /> Novo álbum
        </button>
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
          {custom.map(({ a, photos, cover }) => (
            <Link key={a.id} href={`/albuns/${a.id}`} className="card card--flush" style={{ display: "flex", flexDirection: "column" }}>
              {cover ? (
                <MediaImage id={cover} alt="" className="photo photo--square" style={{ borderRadius: 0 }} />
              ) : (
                <div className="photo photo--square" style={{ borderRadius: 0, display: "grid", placeItems: "center", color: "var(--accent)", background: "var(--accent-soft)" }} aria-hidden="true"><IconAlbum size={36} /></div>
              )}
              <div className="stack" style={{ padding: 12, gap: 2 }}>
                <strong style={{ fontFamily: "var(--font-heading)", overflowWrap: "anywhere" }}>{a.title}</strong>
                <span className="caption">{photos} {photos === 1 ? "foto" : "fotos"} · seu álbum</span>
              </div>
            </Link>
          ))}
        </div>
        </div>
        )}
        <FormSheet open={creating} onClose={() => setCreating(false)} title="Novo álbum" onSubmit={create} busy={busy} error={error} submitLabel="Criar álbum">
          <Field id="album-name" label="Nome do álbum" value={name} onChange={setName} maxLength={LIMITS.albumTitleMaxChars} placeholder="Ex.: Viagem à praia, Primeiro ano" />
        </FormSheet>
      </main>
    </>
  );
}
