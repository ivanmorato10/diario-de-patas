"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCatalog } from "@/i18n/catalog";
import { useFormat } from "@/i18n/use-format";
import { useErrorText } from "@/i18n/use-error";
import { useCustomAlbumTitle } from "@/components/album-picker";
import { useParams, useRouter } from "next/navigation";
import { LIMITS } from "@/config/business";
import { useStore } from "@/data/store";
import { DomainError, type Snapshot } from "@/data/demo-repository";
import { DeleteSheet, Field, FormSheet } from "@/components/care-forms";
import { Sheet } from "@/components/entry-actions";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { ShareSelection } from "@/components/share";
import { useMemo, useState } from "react";
import { COLLECTIONS } from "@/config/catalog";
import { missionState } from "@/domain/missions";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { MediaImage } from "@/components/media";
import { MissionStamp, collectionMissions } from "@/components/mission-ui";
import { IconInfo, IconShare, IconStar } from "@/components/icons";

export default function AlbumDetalhe() {
  const { id } = useParams<{ id: string }>();
  const col = COLLECTIONS.find((c) => c.id === id);
  const { ready, snap, unavailable } = useRequireDiary();
  const t = useTranslations("album");
  const cat = useCatalog(snap?.dog?.name ?? "");
  const customTitle = useCustomAlbumTitle();

  const data = useMemo(() => {
    const completed = new Set(snap?.completions.map((c) => c.missionId) ?? []);
    const entriesById = new Map(snap?.entries.map((e) => [e.id, e]) ?? []);
    const entries = (snap?.albumEntries ?? [])
      .filter((a) => a.albumId === id)
      .map((a) => entriesById.get(a.entryId))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .sort((a, b) => b.occurredDate.localeCompare(a.occurredDate));
    return { completed, entries };
  }, [snap, id]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;
  const custom = snap.customAlbums.find((a) => a.id === id);
  if (!col && custom) return <CustomAlbumView snap={snap} albumId={custom.id} title={customTitle(custom)} entries={data.entries} />;
  if (!col) return (<><TopBar back="/albuns" /><main className="main"><div className="card empty"><h1>{t("notFound")}</h1><Link href="/albuns" className="btn btn--secondary">{t("seeAlbums")}</Link></div></main></>);
  const colText = cat.collection(col.id);

  const missions = collectionMissions(col.id);
  const done = missions.filter((m) => data.completed.has(m.id)).length;
  const missionPhotos = data.entries.filter((e) => e.source === "mission").length;
  const freePhotos = data.entries.length - missionPhotos;

  return (
    <>
      <TopBar title={colText.title} back="/albuns" />
      <main className="main">
        <p className="page-note">{colText.description}</p>
        <div><ShareAlbumButton entries={data.entries} defaultTitle={t("shareDefault", { album: colText.title, dog: snap.dog.name })} /></div>

        {col.hasMissions ? (
          <section className="stack" aria-labelledby="conq">
            <div className="row-between">
              <h2 id="conq">{t("achievements")}</h2>
              <span className="caption">{t("nOf", { n: done, total: missions.length })}</span>
            </div>
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>
              {missions.map((m) => {
                const st = missionState(m, data.completed);
                return (
                  <li key={m.id}>
                    <Link href={`/missoes/${m.slug}`} className="card mission-card" style={{ padding: 12 }}>
                      <MissionStamp state={st} slot />
                      <span style={{ flex: 1 }}>{cat.title(m)}</span>
                      {st === "completed" ? <span className="chip"><IconStar size={14} /> {t("earned")}</span> : <span className="chip chip--outline">+{m.xp} 🐾</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <div className="notice notice--info"><IconInfo /><span>{t.rich("studioNote", { link: (c) => <Link href="/estudio">{c}</Link> })}</span></div>
        )}

        <section className="stack" aria-labelledby="fotos">
          <div className="row-between">
            <h2 id="fotos">{t("photos")}</h2>
            <span className="caption">{t("photoCounts", { mission: missionPhotos, free: freePhotos })}</span>
          </div>
          {data.entries.length === 0 ? (
            <div className="card stitched empty" style={{ boxShadow: "none" }}>
              <p className="muted">{t("noPhotos")}</p>
              <Link href="/guardar" className="btn btn--secondary btn--small">{t("saveMoment")}</Link>
            </div>
          ) : (
            <>
              <div className="grid-photos">
                {data.entries.map((e) =>
                    <Link key={e.id} href={`/diario#${e.id}`}>
                      <MediaImage id={e.mediaId} alt={e.caption || t("albumPhoto")} />
                      {e.source === "mission" ? <span className="grid-badge chip chip--reward" style={{ padding: "2px 6px" }}><IconStar size={12} /><span className="sr-only">{t("missionPhoto")}</span></span> : null}
                    </Link>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}

/** Botão "Compartilhar álbum": abre a lista com todas as fotos marcadas; a pessoa desmarca o que não quer mostrar. */
function ShareAlbumButton({ entries, defaultTitle }: { entries: Snapshot["entries"]; defaultTitle: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const t = useTranslations("album");
  const f = useFormat();
  if (entries.length === 0) return null;
  return (
    <>
      <button type="button" className="btn btn--primary btn--small" onClick={() => { setSelected(new Set(entries.map((e) => e.id))); setOpen(true); }}>
        <IconShare size={18} /> {t("share")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="share-album-title">
        <h2 id="share-album-title">{t("shareTitle", { title: defaultTitle })}</h2>
        <p className="page-note">{t("shareNote")}</p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setSelected(new Set(entries.map((e) => e.id)))}>{t("selectAll")}</button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setSelected(new Set())}>{t("selectNone")}</button>
          <span className="caption" style={{ alignSelf: "center" }}>{t("nOf", { n: selected.size, total: entries.length })}</span>
        </div>
        <div className="grid-photos" style={{ maxHeight: "40dvh", overflowY: "auto" }}>
          {entries.map((e) => (
            <button key={e.id} type="button" aria-pressed={selected.has(e.id)} aria-label={t("photoFrom", { what: e.caption || t("photo"), date: f.date(e.occurredDate) })}
              onClick={() => setSelected((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })}
              style={{ outline: selected.has(e.id) ? "3px solid var(--brand-primary)" : "none", outlineOffset: -3, opacity: selected.has(e.id) ? 1 : 0.45 }}>
              <MediaImage id={e.mediaId} alt="" />
              {selected.has(e.id) ? <span className="grid-badge chip">{t("inLink")}</span> : null}
            </button>
          ))}
        </div>
        {selected.size ? <ShareSelection key={open ? "on" : "off"} selected={[...selected]} defaultTitle={defaultTitle} onDone={() => setOpen(false)} /> : <p className="small muted">{t("pickOne")}</p>}
        <button type="button" className="btn btn--ghost btn--block" onClick={() => setOpen(false)}>{t("close")}</button>
      </Sheet>
    </>
  );
}

/** Álbum criado pela pessoa: só fotos, com o nome que ela quiser (não tem conquistas). */
function CustomAlbumView({ snap, albumId, title, entries }: { snap: Snapshot; albumId: string; title: string; entries: Snapshot["entries"] }) {
  const { repo, reload } = useStore();
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "rename" | "delete" | "add">("none");
  const [name, setName] = useState(title);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inAlbum = new Set(entries.map((e) => e.id));
  const t = useTranslations("album");
  const f = useFormat();
  const errText = useErrorText();
  const candidates = snap.entries.filter((e) => !inAlbum.has(e.id));

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    if (!repo || busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
      setMode("none");
      after?.();
    } catch (e) {
      setError(errText(e instanceof DomainError ? e : null, "errors.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title={title} back="/albuns" />
      <main className="main">
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <ShareAlbumButton entries={entries} defaultTitle={t("shareDefault", { album: title, dog: snap.dog?.name ?? "" })} />
          <button type="button" className="btn btn--secondary btn--small" onClick={() => { setPicked(new Set()); setError(null); setMode("add"); }} disabled={candidates.length === 0}><IconPlus size={18} /> {t("addFromDiary")}</button>
          <button type="button" className="btn btn--secondary btn--small" onClick={() => { setName(title); setError(null); setMode("rename"); }}><IconPencil size={18} /> {t("rename")}</button>
          <button type="button" className="btn btn--ghost btn--small" style={{ color: "var(--danger)" }} onClick={() => setMode("delete")}><IconTrash size={18} /> {t("deleteAlbum")}</button>
        </div>
        <p className="caption">{t("customCount", { count: entries.length })}</p>
        {entries.length === 0 ? (
          <div className="card stitched empty" style={{ boxShadow: "none" }}>
            <p className="muted">{t("empty")}</p>
            {candidates.length ? <button type="button" className="btn btn--secondary btn--small" onClick={() => setMode("add")}>{t("pickFromDiary")}</button> : <Link href="/guardar" className="btn btn--secondary btn--small">{t("saveMoment")}</Link>}
          </div>
        ) : (
          <div className="grid-photos">
            {entries.map((e) => (
              <Link key={e.id} href={`/diario#${e.id}`}>
                <MediaImage id={e.mediaId} alt={e.caption || t("photoOfDate", { date: f.date(e.occurredDate) })} />
              </Link>
            ))}
          </div>
        )}
      </main>

      <Sheet open={mode === "add"} onClose={() => setMode("none")} labelledBy="add-title">
        <h2 id="add-title">{t("addTo", { title })}</h2>
        <p className="page-note">{t("addNote")}</p>
        <div className="grid-photos" style={{ maxHeight: "50dvh", overflowY: "auto" }}>
          {candidates.map((e) => (
            <button key={e.id} type="button" aria-pressed={picked.has(e.id)} aria-label={t("photoFrom", { what: e.caption || t("photo"), date: f.date(e.occurredDate) })}
              onClick={() => setPicked((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })}
              style={{ outline: picked.has(e.id) ? "3px solid var(--brand-primary)" : "none", outlineOffset: -3 }}>
              <MediaImage id={e.mediaId} alt="" />
              {picked.has(e.id) ? <span className="grid-badge chip">{t("picked")}</span> : null}
            </button>
          ))}
        </div>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="stack">
          <button type="button" className="btn btn--primary btn--block" disabled={busy || picked.size === 0} onClick={() => run(() => repo!.addEntriesToAlbum(albumId, [...picked]))}>
            {picked.size ? t("addN", { count: picked.size }) : t("pickPhotos")}
          </button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setMode("none")}>{t("cancel")}</button>
        </div>
      </Sheet>

      <FormSheet open={mode === "rename"} onClose={() => setMode("none")} title={t("renameTitle")} onSubmit={() => run(() => repo!.renameAlbum(albumId, name))} busy={busy} error={error}>
        <Field id="rename" label={t("name")} value={name} onChange={setName} maxLength={LIMITS.albumTitleMaxChars} />
      </FormSheet>
      <DeleteSheet open={mode === "delete"} onClose={() => setMode("none")} title={t("deleteTitle")} text={t("deleteText", { title })} busy={busy}
        onConfirm={() => run(() => repo!.deleteAlbum(albumId), () => router.replace("/albuns"))} />
    </>
  );
}
