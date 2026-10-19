import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AbuMascot } from "@/components/brand";
import { Paw } from "@/components/icons";
import { CONFIG_OK } from "@/config/mode";
import { formatCivilDate } from "@/i18n/format";
import { resolveShare } from "@/server/rpc";

export const dynamic = "force-dynamic"; // revogar precisa valer na hora: nada em cache
// Nada privado no Open Graph: título genérico, sem foto nem nome do cachorro (briefing §12).
// Idioma de quem abre o link (cookie ou navegador), não de quem compartilhou.
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("shared"))("metaTitle"), robots: { index: false, follow: false } };
}

const SIGNUP = "/entrar?modo=criar";

/** Faixa do topo: logo do Diário de Patas, que leva quem não tem conta para criar a sua. */
async function Brand() {
  const t = await getTranslations("shared");
  return (
    <header className="shared-top">
      <Link href={SIGNUP} className="shared-brand" aria-label={t("brandLabel")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/favicon-64.png" alt="" width={40} height={40} />
        <span>
          <span className="shared-brand__name">Diário de Patas</span>
          <span className="shared-brand__tag">Sempre Juntos</span>
        </span>
      </Link>
      <Link href={SIGNUP} className="shared-top__cta">{t("createMine")}</Link>
    </header>
  );
}

/** Convite para quem recebeu o link: o diário do próprio cachorro, grátis. */
async function Invite() {
  const t = await getTranslations("shared");
  return (
    <section className="shared-invite" aria-labelledby="convite">
      <div className="shared-invite__art" aria-hidden="true"><AbuMascot width={120} /></div>
      <div className="stack" style={{ gap: 8 }}>
        <h2 id="convite">{t("inviteTitle")}</h2>
        <p>{t("inviteText")}</p>
        <Link href={SIGNUP} className="shared-btn"><Paw size={18} /> {t("createFree")}</Link>
        <span className="shared-invite__note">{t("inviteNote")}</span>
      </div>
    </section>
  );
}

/**
 * Página compartilhada (briefing §8.10, §12): só a seleção escolhida pelo dono, somente leitura,
 * sem login. Link inexistente, revogado ou expirado → a mesma mensagem neutra (não revela se existiu).
 */
export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = CONFIG_OK ? await resolveShare(token).catch(() => null) : null;
  const t = await getTranslations("shared");
  const locale = await getLocale();
  const date = (d: string) => formatCivilDate(d, locale);

  if (!share) {
    return (
      <div className="shared">
        <Brand />
        <main className="shared-main">
          <section className="shared-empty">
            <AbuMascot width={140} className="anim-float" />
            <h1>{t("unavailableTitle")}</h1>
            <p>{t("unavailableText")}</p>
          </section>
          <Invite />
        </main>
        <footer className="shared-foot">Diário de Patas · Sempre Juntos</footer>
      </div>
    );
  }

  const dates = share.entries.map((e) => e.occurredDate).sort();
  const range = dates.length ? (dates[0] === dates[dates.length - 1] ? date(dates[0]) : t("range", { from: date(dates[0]), to: date(dates[dates.length - 1]) })) : "";

  return (
    <div className="shared">
      <Brand />
      <main className="shared-main">
        <section className="shared-hero">
          {share.avatar ? (
            <span className="shared-avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/s/${token}/perfil`} alt={t("profilePhoto")} style={share.avatar.crop ? { objectPosition: `${share.avatar.crop.x}% ${share.avatar.crop.y}%`, transform: `scale(${share.avatar.crop.zoom})`, transformOrigin: `${share.avatar.crop.x}% ${share.avatar.crop.y}%` } : undefined} />
            </span>
          ) : null}
          <span className="shared-hero__kicker"><Paw size={16} /> {t("kicker")}</span>
          <h1>{share.title}</h1>
          <p>{t("memories", { count: share.entries.length })}{range ? ` · ${range}` : ""}</p>
        </section>

        <section className={`shared-grid${share.entries.length === 1 ? " shared-grid--one" : ""}`} aria-label={t("photos")}>
          {share.entries.map((e, i) => (
            <figure key={e.id} className="shared-photo" style={{ rotate: `${[-1.2, 0.9, -0.5, 1.3][i % 4]}deg` }}>
              <span className="shared-photo__tape" aria-hidden="true" />
              <a href={`/s/${token}/foto/${e.id}`} target="_blank" rel="noopener" aria-label={e.caption ? t("openPhotoCaption", { caption: e.caption }) : t("openPhoto")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/s/${token}/foto/${e.id}`} alt={e.caption ? t("photoCaption", { caption: e.caption }) : t("albumPhoto")} loading={i < 4 ? "eager" : "lazy"} decoding="async" />
              </a>
              <figcaption>
                {e.caption ? <span className="shared-photo__note">{e.caption}</span> : null}
                <span className="shared-photo__date">{date(e.occurredDate)}</span>
              </figcaption>
            </figure>
          ))}
        </section>

        <Invite />
      </main>
      <footer className="shared-foot">
        {t.rich("foot", { link: (c) => <Link href={SIGNUP}>{c}</Link> })}
      </footer>
    </div>
  );
}
