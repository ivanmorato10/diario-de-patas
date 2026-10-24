"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useCatalog } from "@/i18n/catalog";
import { useErrorText } from "@/i18n/use-error";
import { useCustomAlbumTitle } from "@/components/album-picker";
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
  const { snap: storeSnap, repo, reload, patchDog } = useStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("albumsPage");
  const cat = useCatalog(snap?.dog?.name ?? "");
  const customTitle = useCustomAlbumTitle();
  const errText = useErrorText();

  async function create() {
    if (!repo || busy) return;
    setBusy(true);
    setError(null);
    const dogAtStart = storeSnap?.dog?.id;
    try {
      const album = await repo.createAlbum(name);
      // Gravou: o álbum novo entra na tela na hora e a atualização completa vem depois (se falhar, não vira erro).
      patchDog(dogAtStart, (s) => ({ ...s, customAlbums: [...s.customAlbums.filter((x) => x.id !== album.id), album] }));
      void reload().catch(() => undefined);
      setCreating(false);
      setName("");
      router.push(`/albuns/${album.id}`);
    } catch (e) {
      setError(errText(e instanceof DomainError ? e : null, "albumsPage.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap) return <main className="main"><PageLoading /></main>;
  return (
    <>
      <TopBar title={t("title")} emoji="🖼️" />
      <main className="main">
        <div role="tablist" aria-label={t("tabsLabel")} className="tabs">
          {([["albuns", t("title")], ["colecoes", t("collectionsTab", { n: snap.medals.length, total: 5 })]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className={`tab${tab === id ? " is-active" : ""}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {tab === "colecoes" ? (
          <div role="tabpanel" id="panel-colecoes" aria-labelledby="tab-colecoes"><CollectionsView snap={snap} /></div>
        ) : (
        <div role="tabpanel" id="panel-albuns" aria-labelledby="tab-albuns" className="stack">
        <p className="page-note">{t("intro")}</p>
        <button type="button" className="btn btn--secondary" style={{ alignSelf: "flex-start" }} onClick={() => { setError(null); setCreating(true); }} disabled={(snap.customAlbums?.length ?? 0) >= LIMITS.maxCustomAlbums}>
          <IconPlus /> {t("newAlbum")}
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
                <strong style={{ fontFamily: "var(--font-heading)" }}>{cat.collection(c.id).title}</strong>
                <span className="caption">{t("photos", { count: photos })}{c.hasMissions ? ` · ${t("achievements", { done, total })}` : ""}</span>
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
                <strong style={{ fontFamily: "var(--font-heading)", overflowWrap: "anywhere" }}>{customTitle(a)}</strong>
                <span className="caption">{t("photos", { count: photos })} · {t("yours")}</span>
              </div>
            </Link>
          ))}
        </div>
        </div>
        )}
        <FormSheet open={creating} onClose={() => setCreating(false)} title={t("newAlbum")} onSubmit={create} busy={busy} error={error} submitLabel={t("create")}>
          <Field id="album-name" label={t("name")} value={name} onChange={setName} maxLength={LIMITS.albumTitleMaxChars} placeholder={t("namePlaceholder")} />
        </FormSheet>
      </main>
    </>
  );
}
