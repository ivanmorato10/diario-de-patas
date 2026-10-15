"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { ROLE_PT, switchDog } from "@/data/family-client";
import { REAL_MODE } from "@/config/mode";
import { Sheet } from "./entry-actions";
import { DogAvatar } from "./media";

/** Lista "Seus cachorros": trocar de cachorro (não troca a conta) e "+ Adicionar cachorro". */
export function DogList({ onDone }: { onDone?: () => void }) {
  const { snap, reload } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = snap?.dog?.id;
  const diaries = snap?.diaries ?? [];

  async function pick(id: string) {
    if (id === current) return onDone?.();
    setBusy(id);
    setError(null);
    try {
      await switchDog(id);
      await reload();
      onDone?.();
      router.push("/hoje");
    } catch {
      setError("Não deu para trocar agora. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <ul className="dog-list" role="list">
        {diaries.map((d) => (
          <li key={d.id}>
            <button type="button" className={`dog-list__item${d.id === current ? " dog-list__item--on" : ""}`} onClick={() => pick(d.id)} disabled={!!busy} aria-current={d.id === current ? "true" : undefined}>
              <DogAvatar mediaId={d.photoMediaId} name={d.name} crop={d.avatarCrop} />
              <span className="dog-list__text"><strong>{d.name}</strong><span className="caption">{ROLE_PT[d.role]}</span></span>
              <span className="dog-list__mark" aria-hidden="true">{busy === d.id ? "…" : d.id === current ? "✓" : ""}</span>
            </button>
          </li>
        ))}
      </ul>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <button type="button" className="btn btn--secondary btn--block" onClick={() => { onDone?.(); router.push("/adicionar"); }}>+ Adicionar cachorro</button>
    </div>
  );
}

/** Título "Diário de Pepe ▾" do Hoje: com mais de um cachorro, abre "Seus cachorros". */
export function DogTitle({ name }: { name: string }) {
  const { snap } = useStore();
  const [open, setOpen] = useState(false);
  const many = REAL_MODE && (snap?.diaries?.length ?? 0) > 1;
  if (!many) return <h1 id="dog-title" className="hoje-title">Diário de {name}</h1>;
  return (
    <>
      <h1 id="dog-title" className="hoje-title">
        <button type="button" className="dog-title-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
          Diário de {name} <span className="dog-title-btn__arrow" aria-hidden="true">▾</span><span className="sr-only"> (trocar de cachorro)</span>
        </button>
      </h1>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="dogs-title">
        <h2 id="dogs-title">Seus cachorros</h2>
        <DogList onDone={() => setOpen(false)} />
        <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 8 }} onClick={() => setOpen(false)}>Fechar</button>
      </Sheet>
    </>
  );
}
