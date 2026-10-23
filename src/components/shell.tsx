"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useStore } from "@/data/store";
import { CONFIG_OK } from "@/config/mode";
import { IconAlbum, IconArrowLeft, IconBook, IconBrush, IconHeart, IconSun, IconUser } from "./icons";
import { DogMenu } from "./dog-switcher";
import { DogBell } from "./notifications";
import { AbuFace, BrandLockup } from "./brand";
import { IN_APP_NAV } from "./service-worker";

const NAV = [
  { href: "/hoje", label: "today", Icon: IconSun },
  { href: "/diario", label: "diary", Icon: IconBook },
  { href: "/albuns", label: "albums", Icon: IconAlbum },
  { href: "/cuidados", label: "care", Icon: IconHeart },
  { href: "/estudio", label: "studio", Icon: IconBrush },
] as const;


export function BottomNav() {
  const path = usePathname();
  const t = useTranslations("shell");
  return (
    <nav className="bottom-nav" aria-label={t("mainNav")}>
      <ul>
        {NAV.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}>
                <span className="nav-icon"><Icon /></span>
                {t(`nav.${label}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** `emoji`: identidade rápida da tela, ao lado do título (cada tela passa o seu). */
/**
 * `backHistory`: o "voltar" volta uma página (de onde a pessoa veio); aberta direto, sem página anterior, vai para
 * `back`. Usado nas páginas que se abrem de vários lugares (Termos, Privacidade, Reembolso).
 */
export function TopBar({ title, back, emoji, backHistory }: { title?: string; back?: string; emoji?: string; backHistory?: boolean }) {
  const { snap } = useStore();
  const t = useTranslations("shell");
  const dog = snap?.dog;
  const viewer = snap?.role === "viewer";
  // "Só ver": o CSS esconde os atalhos de guardar/editar (o servidor também recusa).
  useEffect(() => {
    document.documentElement.dataset.role = snap?.role ?? "admin";
  }, [snap?.role]);
  return (
    <>
    {viewer && dog ? <div className="viewer-banner" role="note">{t("viewerBanner", { dog: dog.name })}</div> : null}
    <header className="topbar">
      <div className="topbar__inner">
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          {back ? (
            backHistory ? (
              <a href={back} className="icon-btn" aria-label={t("back")} onClick={(e) => {
                let inApp = false;
                try { inApp = sessionStorage.getItem(IN_APP_NAV) === "1"; } catch { /* sem armazenamento */ }
                if (inApp && window.history.length > 1) { e.preventDefault(); window.history.back(); }
              }}><IconArrowLeft /></a>
            ) : (
              <Link href={back} className="icon-btn" aria-label={t("back")}><IconArrowLeft /></Link>
            )
          ) : (
            <Link href="/hoje" aria-label={t("home")} style={{ display: "inline-flex" }}>{title ? <AbuFace size={38} className="brand-lockup__face" /> : <BrandLockup />}</Link>
          )}
          {title ? <h1 className="topbar__title">{emoji ? <span className="topbar__emoji" aria-hidden="true">{emoji}</span> : null}<span className="topbar__text">{title}</span></h1> : null}
        </div>
        {dog ? (
          <div className="topbar__actions">
            <DogBell />
            <Link href="/conta" className="topbar__person" aria-label={t("myAccount")}><IconUser size={20} /></Link>
            <DogMenu />
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
    if (snap && !snap.dog) router.replace("/adicionar");
  }, [snap, router]);
  return { ready: !!snap?.dog, snap, unavailable };
}

/** Falha ao abrir o diário (sem internet, servidor fora ou configuração faltando). Nunca cria um diário local. */
export function StorageUnavailable() {
  const t = useTranslations("shell");
  return (
    <div className="card stack" role="alert">
      <h2>{t("unavailableTitle")}</h2>
      <p className="muted">{CONFIG_OK ? t("checkInternet") : t("appUnavailable")}</p>
      <button type="button" className="btn btn--secondary" onClick={() => window.location.reload()}>{t("retry")}</button>
    </div>
  );
}

export function PageLoading() {
  const t = useTranslations("shell");
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t("loading")}</span>
      <div className="skeleton" style={{ height: 120 }} />
      <div className="skeleton" style={{ height: 80 }} />
    </div>
  );
}
