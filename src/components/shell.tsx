"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/data/store";
import { REAL_MODE } from "@/config/mode";
import { IconAlbum, IconArrowLeft, IconBook, IconBrush, IconHeart, IconSun, IconUser } from "./icons";
import { DogAvatar } from "./media";
import { AbuFace, BrandLockup } from "./brand";

const NAV = [
  { href: "/hoje", label: "Hoje", Icon: IconSun },
  { href: "/diario", label: "Diário", Icon: IconBook },
  { href: "/albuns", label: "Álbuns", Icon: IconAlbum },
  { href: "/cuidados", label: "Cuidados", Icon: IconHeart },
  { href: "/estudio", label: "Estúdio", Icon: IconBrush },
];

export function DemoBanner() {
  if (REAL_MODE) return null; // com contas, o diário fica na conta — não há demonstração
  return (
    <div className="demo-banner" role="note">
      Modo demonstração: tudo fica só neste aparelho, sem conta. <Link href="/sobre#demo">Saiba mais</Link>
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

/** Emoji ao lado do título de cada tela (identidade rápida das abas). */
const TITLE_EMOJI: Record<string, string> = {
  "Diário": "📖", "Álbuns": "🖼️", "Cuidados": "🩺", "Estúdio": "🎨", "Missões": "⭐", "Perfil e ajustes": "⚙️", "Créditos": "🪙",
  "Achadinhos do Abu": "🛍️", "Sobre": "🐾", "Minha conta": "👤", "Medicamentos": "💊", "Consultas e visitas": "🩺", "Vacinas e vermífugos": "💉",
  "Contatos": "📞", "Documentos": "📄", "Peso": "⚖️", "Guardar momento": "📸", "Cartinha": "💌",
};

const emojiFor = (title: string) => TITLE_EMOJI[title] ?? (title.startsWith("Perfil de ") ? "🐶" : undefined);

export function TopBar({ title, back }: { title?: string; back?: string }) {
  const { snap } = useStore();
  const dog = snap?.dog;
  const viewer = REAL_MODE && snap?.role === "viewer";
  // "Só ver": o CSS esconde os atalhos de guardar/editar (o servidor também recusa).
  useEffect(() => {
    document.documentElement.dataset.role = snap?.role ?? "admin";
  }, [snap?.role]);
  return (
    <>
    {viewer && dog ? <div className="viewer-banner" role="note">👀 Você está acompanhando o diário de {dog.name}.</div> : null}
    <header className="topbar">
      <div className="topbar__inner">
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          {back ? (
            <Link href={back} className="icon-btn" aria-label="Voltar"><IconArrowLeft /></Link>
          ) : (
            <Link href="/hoje" aria-label="Diário de Patas — início" style={{ display: "inline-flex" }}>{title ? <AbuFace size={38} className="brand-lockup__face" /> : <BrandLockup />}</Link>
          )}
          {title ? <h1 className="topbar__title">{emojiFor(title) ? <span className="topbar__emoji" aria-hidden="true">{emojiFor(title)}</span> : null}<span className="topbar__text">{title}</span></h1> : null}
        </div>
        {dog ? (
          <div className="topbar__actions">
            <Link href="/conta" className="topbar__person" aria-label="Minha conta"><IconUser size={20} /></Link>
            <Link href="/perfil" aria-label={`Perfil de ${dog.name}`} style={{ borderRadius: "50%" }}>
              <DogAvatar mediaId={dog.photoMediaId} name={dog.name} crop={dog.avatarCrop} />
            </Link>
          </div>
        ) : null}
      </div>
    </header>
    </>
  );
}

/** Garante que existe um diário; caso contrário leva às boas-vindas. */
export function useRequireDiary() {
  const { snap, unavailable } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (snap && !snap.dog) router.replace(REAL_MODE ? "/adicionar" : "/bem-vindo");
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
