"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { switchDog } from "@/data/family-client";
import { Sheet } from "./entry-actions";
import { DogAvatar } from "./media";
import { IconPencil } from "./icons";

/** Lista "Seus cachorros": trocar de cachorro (não troca a conta) e "+ Adicionar cachorro". */
export function DogList({ onDone }: { onDone?: () => void }) {
  const { snap, reload } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("dogs");
  const tf = useTranslations("family");
  const current = snap?.dog?.id;
  const diaries = snap?.diaries ?? [];

  async function pick(id: string, then = "/hoje") {
    if (id === current) { onDone?.(); if (then !== "/hoje") router.push(then); return; }
    setBusy(id);
    setError(null);
    try {
      await switchDog(id);
    } catch {
      setError(t("switchFailed"));
      setBusy(null);
      return;
    }
    // Trocou: carrega o diário escolhido; se a conferência falhar, abre o app do zero nele (não diz "não trocou").
    try {
      await reload();
      onDone?.();
      router.push(then);
    } catch {
      window.location.assign(then);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <ul className="dog-list" role="list">
        {diaries.map((d) => (
          <li key={d.id} className="dog-list__row">
            <button type="button" className={`dog-list__item${d.id === current ? " dog-list__item--on" : ""}`} onClick={() => pick(d.id)} disabled={!!busy} aria-current={d.id === current ? "true" : undefined}>
              <DogAvatar mediaId={d.photoMediaId} name={d.name} crop={d.avatarCrop} />
              <span className="dog-list__text"><strong>{d.name}</strong><span className="caption">{tf(`roles.${d.role}`)}</span></span>
              <span className="dog-list__mark" aria-hidden="true">{busy === d.id ? "…" : d.id === current ? "✓" : ""}</span>
            </button>
            {/* Editar o perfil: só para quem pode editar aquele cachorro. */}
            {d.role !== "viewer" ? (
              <button type="button" className="dog-list__edit" onClick={() => pick(d.id, "/perfil")} disabled={!!busy} aria-label={t("editProfile", { dog: d.name })}><IconPencil size={18} /></button>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <button type="button" className="btn btn--secondary btn--block" onClick={() => { onDone?.(); router.push("/adicionar"); }}>{t("add")}</button>
    </div>
  );
}

/** Foto do cachorro no topo: abre "Seus cachorros" (trocar), o perfil dele e "+ Adicionar cachorro". */
export function DogMenu() {
  const { snap } = useStore();
  const router = useRouter(); // o perfil começa a carregar quando o menu abre (antes do toque no lápis)
  const [open, setOpen] = useState(false);
  const t = useTranslations("dogs");
  const dog = snap?.dog;
  if (!dog) return null;
  const count = snap?.diaries?.length ?? 0;
  return (
    <>
      <button type="button" className="dog-switch" onClick={() => { setOpen(true); router.prefetch("/perfil"); }} aria-label={t("menuLabel", { dog: dog.name })} aria-haspopup="dialog">
        <DogAvatar mediaId={dog.photoMediaId} name={dog.name} crop={dog.avatarCrop} />
        {count > 1 ? <span className="dog-switch__count" aria-hidden="true">{count}</span> : null}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="dogs-title">
        <h2 id="dogs-title">{t("title")}</h2>
        <DogList onDone={() => setOpen(false)} />
        <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 8 }} onClick={() => setOpen(false)}>{t("close")}</button>
      </Sheet>
    </>
  );
}
