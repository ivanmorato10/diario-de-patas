"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { COLLECTIONS, type CollectionId } from "@/config/catalog";
import { STUDIO_ALBUM_TITLE } from "@/config/studio";
import { useStore } from "@/data/store";
import { useCatalog } from "@/i18n/catalog";
import type { CustomAlbum } from "@/domain/types";

/** Nome de um álbum criado: o da pessoa; o automático "Artes do Estúdio" aparece no idioma de quem vê (até ser renomeado). */
export function useCustomAlbumTitle() {
  const t = useTranslations("albums");
  return useCallback((a: Pick<CustomAlbum, "title" | "systemKey">) => (a.systemKey === "studio" && a.title === STUDIO_ALBUM_TITLE ? t("studioArt") : a.title), [t]);
}

/** Nome de qualquer álbum: coleção do catálogo ou álbum criado pela pessoa. */
export function useAlbumTitle() {
  const { snap } = useStore();
  const t = useTranslations("albums");
  const cat = useCatalog(snap?.dog?.name ?? "");
  const custom = useCustomAlbumTitle();
  return (id: string) => {
    if (COLLECTIONS.some((c) => c.id === id)) return cat.collection(id as CollectionId).title;
    const a = snap?.customAlbums.find((x) => x.id === id);
    return a ? custom(a) : t("album");
  };
}

/** Caixas de seleção de álbuns: os do catálogo e os que a pessoa criou. */
export function AlbumChecklist({ value, onChange, legend, hint = true }: { value: string[]; onChange: (v: string[]) => void; legend: string; hint?: boolean }) {
  const { snap } = useStore();
  const t = useTranslations("albums");
  const cat = useCatalog(snap?.dog?.name ?? "");
  const custom = useCustomAlbumTitle();
  const all = [...COLLECTIONS.map((c) => ({ id: c.id as string, title: cat.collection(c.id).title })), ...(snap?.customAlbums ?? []).map((a) => ({ id: a.id as string, title: custom(a) }))];
  return (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 600, marginBottom: 8 }}>{legend}</legend>
      {hint ? <p className="caption">{t("freeHint")}</p> : null}
      {all.map((c) => (
        <label key={c.id} className="check">
          <input type="checkbox" checked={value.includes(c.id)} onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))} />
          <span>{c.title}</span>
        </label>
      ))}
    </fieldset>
  );
}
