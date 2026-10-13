"use client";

import { COLLECTIONS } from "@/config/catalog";
import { useStore } from "@/data/store";

/** Nome de qualquer álbum: coleção do catálogo ou álbum criado pela pessoa. */
export function useAlbumTitle() {
  const { snap } = useStore();
  return (id: string) => COLLECTIONS.find((c) => c.id === id)?.title ?? snap?.customAlbums.find((a) => a.id === id)?.title ?? "Álbum";
}

/** Caixas de seleção de álbuns: os do catálogo e os que a pessoa criou. */
export function AlbumChecklist({ value, onChange, legend, hint = true }: { value: string[]; onChange: (v: string[]) => void; legend: string; hint?: boolean }) {
  const { snap } = useStore();
  const all = [...COLLECTIONS.map((c) => ({ id: c.id as string, title: c.title })), ...(snap?.customAlbums ?? []).map((a) => ({ id: a.id as string, title: a.title }))];
  return (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 600, marginBottom: 8 }}>{legend}</legend>
      {hint ? <p className="caption">Fotos livres enfeitam o álbum, mas não contam como conquista.</p> : null}
      {all.map((c) => (
        <label key={c.id} className="check">
          <input type="checkbox" checked={value.includes(c.id)} onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))} />
          <span>{c.title}</span>
        </label>
      ))}
    </fieldset>
  );
}
