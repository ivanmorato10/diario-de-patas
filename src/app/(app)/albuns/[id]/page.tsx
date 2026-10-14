"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { LIMITS } from "@/config/business";
import { useStore } from "@/data/store";
import { DomainError, type Snapshot } from "@/data/demo-repository";
import { DeleteSheet, Field, FormSheet } from "@/components/care-forms";
import { Sheet } from "@/components/entry-actions";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { ShareSelection } from "@/components/share";
import { formatCivilDate } from "@/domain/dates";
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
  if (!col && custom) return <CustomAlbumView snap={snap} albumId={custom.id} title={custom.title} entries={data.entries} />;
  if (!col) return (<><TopBar back="/albuns" /><main className="main"><div className="card empty"><h1>Álbum não encontrado</h1><Link href="/albuns" className="btn btn--secondary">Ver álbuns</Link></div></main></>);

  const missions = collectionMissions(col.id);
  const done = missions.filter((m) => data.completed.has(m.id)).length;
  const missionPhotos = data.entries.filter((e) => e.source === "mission").length;
  const freePhotos = data.entries.length - missionPhotos;

  return (
    <>
      <TopBar title={col.title} back="/albuns" />
      <main className="main">
        <p className="page-note">{col.description}</p>
        <div><ShareAlbumButton entries={data.entries} defaultTitle={`${col.title} de ${snap.dog.name}`} /></div>

        {col.hasMissions ? (
          <section className="stack" aria-labelledby="conq">
            <div className="row-between">
              <h2 id="conq">Conquistas</h2>
              <span className="caption">{done} de {missions.length}</span>
            </div>
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>
              {missions.map((m) => {
                const st = missionState(m, data.completed);
                return (
                  <li key={m.id}>
                    <Link href={`/missoes/${m.slug}`} className="card mission-card" style={{ padding: 12 }}>
                      <MissionStamp state={st} slot />
                      <span style={{ flex: 1 }}>{m.title}</span>
                      {st === "completed" ? <span className="chip"><IconStar size={14} /> Conquistada</span> : <span className="chip chip--outline">+{m.xp} XP</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <div className="notice notice--info"><IconInfo /><span>Aqui ficam as artes criadas no <Link href="/estudio">Estúdio</Link>.</span></div>
        )}

        <section className="stack" aria-labelledby="fotos">
          <div className="row-between">
            <h2 id="fotos">Fotos</h2>
            <span className="caption">{missionPhotos} de missão · {freePhotos} livres</span>
          </div>
          {data.entries.length === 0 ? (
            <div className="card stitched empty" style={{ boxShadow: "none" }}>
              <p className="muted">Nenhuma foto neste álbum ainda.</p>
              <Link href="/guardar" className="btn btn--secondary btn--small">Guardar momento</Link>
            </div>
          ) : (
            <>
              <div className="grid-photos">
                {data.entries.map((e) =>
                    <Link key={e.id} href={`/diario#${e.id}`}>
                      <MediaImage id={e.mediaId} alt={e.caption || "Foto do álbum"} />
                      {e.source === "mission" ? <span className="grid-badge chip chip--reward" style={{ padding: "2px 6px" }}><IconStar size={12} /><span className="sr-only">Foto de missão</span></span> : null}
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
  if (entries.length === 0) return null;
  return (
    <>
      <button type="button" className="btn btn--primary btn--small" onClick={() => { setSelected(new Set(entries.map((e) => e.id))); setOpen(true); }}>
        <IconShare size={18} /> Compartilhar álbum
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="share-album-title">
        <h2 id="share-album-title">Compartilhar “{defaultTitle}”</h2>
        <p className="small muted">Todas as fotos já estão marcadas. Toque numa foto para tirar do link. Quem recebe vê só estas fotos, sem precisar de conta, e você pode cancelar o link quando quiser em Ajustes.</p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setSelected(new Set(entries.map((e) => e.id)))}>Marcar todas</button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setSelected(new Set())}>Desmarcar todas</button>
          <span className="caption" style={{ alignSelf: "center" }}>{selected.size} de {entries.length}</span>
        </div>
        <div className="grid-photos" style={{ maxHeight: "40dvh", overflowY: "auto" }}>
          {entries.map((e) => (
            <button key={e.id} type="button" aria-pressed={selected.has(e.id)} aria-label={`${e.caption || "Foto"} de ${formatCivilDate(e.occurredDate)}`}
              onClick={() => setSelected((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })}
              style={{ outline: selected.has(e.id) ? "3px solid var(--brand-primary)" : "none", outlineOffset: -3, opacity: selected.has(e.id) ? 1 : 0.45 }}>
              <MediaImage id={e.mediaId} alt="" />
              {selected.has(e.id) ? <span className="grid-badge chip">No link</span> : null}
            </button>
          ))}
        </div>
        {selected.size ? <ShareSelection key={open ? "on" : "off"} selected={[...selected]} defaultTitle={defaultTitle} onDone={() => setOpen(false)} /> : <p className="small muted">Marque pelo menos uma foto.</p>}
        <button type="button" className="btn btn--ghost btn--block" onClick={() => setOpen(false)}>Fechar</button>
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
      setError(e instanceof DomainError ? e.message : "Não conseguimos salvar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title={title} back="/albuns" />
      <main className="main">
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <ShareAlbumButton entries={entries} defaultTitle={`${title} de ${snap.dog?.name ?? ""}`.trim()} />
          <button type="button" className="btn btn--secondary btn--small" onClick={() => { setPicked(new Set()); setError(null); setMode("add"); }} disabled={candidates.length === 0}><IconPlus size={18} /> Adicionar fotos do diário</button>
          <button type="button" className="btn btn--secondary btn--small" onClick={() => { setName(title); setError(null); setMode("rename"); }}><IconPencil size={18} /> Renomear</button>
          <button type="button" className="btn btn--ghost btn--small" style={{ color: "var(--danger)" }} onClick={() => setMode("delete")}><IconTrash size={18} /> Excluir álbum</button>
        </div>
        <p className="caption">{entries.length} {entries.length === 1 ? "foto" : "fotos"}. Para tirar uma foto daqui, edite a lembrança no Diário.</p>
        {entries.length === 0 ? (
          <div className="card stitched empty" style={{ boxShadow: "none" }}>
            <p className="muted">Este álbum ainda está vazio.</p>
            {candidates.length ? <button type="button" className="btn btn--secondary btn--small" onClick={() => setMode("add")}>Escolher fotos do diário</button> : <Link href="/guardar" className="btn btn--secondary btn--small">Guardar momento</Link>}
          </div>
        ) : (
          <div className="grid-photos">
            {entries.map((e) => (
              <Link key={e.id} href={`/diario#${e.id}`}>
                <MediaImage id={e.mediaId} alt={e.caption || `Foto de ${formatCivilDate(e.occurredDate)}`} />
              </Link>
            ))}
          </div>
        )}
      </main>

      <Sheet open={mode === "add"} onClose={() => setMode("none")} labelledBy="add-title">
        <h2 id="add-title">Adicionar a “{title}”</h2>
        <p className="small muted">Toque nas fotos que quer colocar neste álbum. Elas continuam no diário e nos outros álbuns.</p>
        <div className="grid-photos" style={{ maxHeight: "50dvh", overflowY: "auto" }}>
          {candidates.map((e) => (
            <button key={e.id} type="button" aria-pressed={picked.has(e.id)} aria-label={`${e.caption || "Foto"} de ${formatCivilDate(e.occurredDate)}`}
              onClick={() => setPicked((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })}
              style={{ outline: picked.has(e.id) ? "3px solid var(--brand-primary)" : "none", outlineOffset: -3 }}>
              <MediaImage id={e.mediaId} alt="" />
              {picked.has(e.id) ? <span className="grid-badge chip">Escolhida</span> : null}
            </button>
          ))}
        </div>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="stack">
          <button type="button" className="btn btn--primary btn--block" disabled={busy || picked.size === 0} onClick={() => run(() => repo!.addEntriesToAlbum(albumId, [...picked]))}>
            {picked.size ? `Adicionar ${picked.size} ${picked.size === 1 ? "foto" : "fotos"}` : "Escolha as fotos"}
          </button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setMode("none")}>Cancelar</button>
        </div>
      </Sheet>

      <FormSheet open={mode === "rename"} onClose={() => setMode("none")} title="Renomear álbum" onSubmit={() => run(() => repo!.renameAlbum(albumId, name))} busy={busy} error={error}>
        <Field id="rename" label="Nome do álbum" value={name} onChange={setName} maxLength={LIMITS.albumTitleMaxChars} />
      </FormSheet>
      <DeleteSheet open={mode === "delete"} onClose={() => setMode("none")} title="Excluir este álbum?" text={`“${title}” deixa de existir. As fotos continuam no diário e nos outros álbuns.`} busy={busy}
        onConfirm={() => run(() => repo!.deleteAlbum(albumId), () => router.replace("/albuns"))} />
    </>
  );
}
