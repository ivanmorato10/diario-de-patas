"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { ROLE_PT, switchDog } from "@/data/family-client";
import type { Dog } from "@/domain/types";
import { Sheet } from "./entry-actions";
import { DogAvatar } from "./media";

/** Foto do cachorro no topo: abre a troca de diário (vários cachorros), a família e os ajustes. */
export function DogSwitcher({ dog }: { dog: Dog }) {
  const { snap, reload } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const diaries = snap?.diaries ?? [];

  async function pick(id: string) {
    if (id === dog.id) return setOpen(false);
    setBusy(id);
    setError(null);
    try {
      await switchDog(id);
      await reload();
      setOpen(false);
      router.push("/hoje");
    } catch {
      setError("Não deu para trocar agora. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  const go = (href: string) => { setOpen(false); router.push(href); };

  return (
    <>
      <button type="button" className="dog-switch" onClick={() => setOpen(true)} aria-label={`Trocar de diário ou ajustes (${dog.name})`} aria-haspopup="dialog">
        <DogAvatar mediaId={dog.photoMediaId} name={dog.name} crop={dog.avatarCrop} />
        {diaries.length > 1 ? <span className="dog-switch__count" aria-hidden="true">{diaries.length}</span> : null}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="dogs-title">
        <h2 id="dogs-title">Seus diários</h2>
        <ul className="dog-list" role="list">
          {diaries.map((d) => (
            <li key={d.id}>
              <button type="button" className={`dog-list__item${d.id === dog.id ? " dog-list__item--on" : ""}`} onClick={() => pick(d.id)} disabled={!!busy} aria-current={d.id === dog.id ? "true" : undefined}>
                <DogAvatar mediaId={d.photoMediaId} name={d.name} crop={d.avatarCrop} />
                <span className="dog-list__text"><strong>{d.name}</strong><span className="caption">{ROLE_PT[d.role]}</span></span>
                <span className="dog-list__mark" aria-hidden="true">{busy === d.id ? "…" : d.id === dog.id ? "✓" : ""}</span>
              </button>
            </li>
          ))}
        </ul>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="stack" style={{ gap: 8 }}>
          <button type="button" className="btn btn--secondary btn--block" onClick={() => go("/comecar?novo=1")}>+ Novo cachorro</button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => go("/config#familia")}>👨‍👩‍👧 Família e convites</button>
          <Link href="/config" className="btn btn--ghost btn--block" onClick={() => setOpen(false)}>⚙️ Perfil de {dog.name} e ajustes</Link>
        </div>
      </Sheet>
    </>
  );
}
