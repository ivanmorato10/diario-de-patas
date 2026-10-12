"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/data/store";
import { IconAlbum, IconArrowLeft, IconBook, IconBrush, IconSun } from "./icons";
import { DogAvatar } from "./media";
import { NotebookMark } from "./brand";

const NAV = [
  { href: "/hoje", label: "Hoje", Icon: IconSun },
  { href: "/diario", label: "Diário", Icon: IconBook },
  { href: "/albuns", label: "Álbuns", Icon: IconAlbum },
  { href: "/estudio", label: "Estúdio", Icon: IconBrush },
];

export function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      Modo demonstração: tudo fica só neste aparelho, sem conta e sem IA. <Link href="/sobre#demo">Saiba mais</Link>
    </div>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <ul>
        {NAV.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}>
                <span className="nav-icon"><Icon /></span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopBar({ title, back }: { title?: string; back?: string }) {
  const { snap } = useStore();
  const dog = snap?.dog;
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          {back ? (
            <Link href={back} className="icon-btn" aria-label="Voltar"><IconArrowLeft /></Link>
          ) : (
            <Link href="/hoje" aria-label="Diário de Patas — início" style={{ display: "inline-flex" }}><NotebookMark size={32} /></Link>
          )}
          {title ? <h1 style={{ fontSize: "1.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h1> : null}
        </div>
        {dog ? (
          <Link href="/config" aria-label={`Perfil e configurações de ${dog.name}`} style={{ borderRadius: "50%" }}>
            <DogAvatar mediaId={dog.photoMediaId} name={dog.name} />
          </Link>
        ) : null}
      </div>
    </header>
  );
}

/** Garante que existe um diário; caso contrário leva às boas-vindas. */
export function useRequireDiary() {
  const { snap, unavailable } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (snap && !snap.dog) router.replace("/bem-vindo");
  }, [snap, router]);
  return { ready: !!snap?.dog, snap, unavailable };
}

export function StorageUnavailable() {
  return (
    <div className="card stack" role="alert">
      <h2>Não deu para abrir o diário neste navegador</h2>
      <p className="muted">O modo demonstração guarda as fotos no próprio navegador. Ele pode estar bloqueado em janelas privadas ou com o armazenamento desativado. Tente uma janela normal.</p>
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className="skeleton" style={{ height: 120 }} />
      <div className="skeleton" style={{ height: 80 }} />
    </div>
  );
}
