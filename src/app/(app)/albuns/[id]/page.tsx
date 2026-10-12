"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
  if (!col) return (<><TopBar back="/albuns" /><main className="main"><div className="card empty"><h1>Álbum não encontrado</h1><Link href="/albuns" className="btn btn--secondary">Ver álbuns</Link></div></main></>);

  const missions = collectionMissions(col.id);
  const done = missions.filter((m) => data.completed.has(m.id)).length;
  const missionPhotos = data.entries.filter((e) => e.source === "mission").length;
  const freePhotos = data.entries.length - missionPhotos;

  return (
    <>
      <TopBar title={col.title} back="/albuns" />
      <main className="main">
        <p className="muted">{col.description}</p>

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
          <div className="notice notice--info"><IconInfo /><span>Aqui ficam as artes do Estúdio. A geração de artes ainda não está ativa nesta versão.</span></div>
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
                  selecting ? (
                    <button key={e.id} type="button" aria-pressed={selected.has(e.id)} onClick={() => setSelected((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })} style={{ outline: selected.has(e.id) ? "3px solid var(--brand-primary)" : "none", outlineOffset: -3 }}>
                      <MediaImage id={e.mediaId} alt={e.caption || "Foto do álbum"} />
                      {selected.has(e.id) ? <span className="grid-badge chip">Selecionada</span> : null}
                    </button>
                  ) : (
                    <Link key={e.id} href={`/diario#${e.id}`}>
                      <MediaImage id={e.mediaId} alt={e.caption || "Foto do álbum"} />
                      {e.source === "mission" ? <span className="grid-badge chip chip--reward" style={{ padding: "2px 6px" }}><IconStar size={12} /><span className="sr-only">Foto de missão</span></span> : null}
                    </Link>
                  ),
                )}
              </div>
              <div className="card stack" style={{ padding: 16 }}>
                <div className="row"><IconShare /><strong>Compartilhar uma seleção</strong></div>
                {selecting ? (
                  <>
                    <p className="small">{selected.size} {selected.size === 1 ? "foto selecionada" : "fotos selecionadas"}.</p>
                    <button type="button" className="btn btn--primary btn--small" disabled aria-describedby="share-off">Criar link</button>
                    <p id="share-off" className="caption">Links de compartilhamento precisam de conta e servidor para poderem ser revogados com segurança. Chegam na próxima etapa — nada foi enviado.</p>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => { setSelecting(false); setSelected(new Set()); }}>Cancelar seleção</button>
                  </>
                ) : (
                  <>
                    <p className="small muted">Escolha as fotos que quer mostrar. Só a seleção aparece no link, e você poderá revogá-lo.</p>
                    <button type="button" className="btn btn--secondary btn--small" onClick={() => setSelecting(true)}>Selecionar fotos</button>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
