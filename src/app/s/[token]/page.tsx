import type { Metadata } from "next";
import Link from "next/link";
import { AbuMascot } from "@/components/brand";
import { Paw } from "@/components/icons";
import { CONFIG_OK } from "@/config/mode";
import { formatCivilDate } from "@/domain/dates";
import { resolveShare } from "@/server/rpc";

export const dynamic = "force-dynamic"; // revogar precisa valer na hora: nada em cache
// Nada privado no Open Graph: título genérico, sem foto nem nome do cachorro (briefing §12).
export const metadata: Metadata = {
  title: "Álbum compartilhado",
  robots: { index: false, follow: false },
};

const SIGNUP = "/entrar?modo=criar";

/** Faixa do topo: logo do Diário de Patas, que leva quem não tem conta para criar a sua. */
function Brand() {
  return (
    <header className="shared-top">
      <Link href={SIGNUP} className="shared-brand" aria-label="Diário de Patas — criar meu diário">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/favicon-64.png" alt="" width={40} height={40} />
        <span>
          <span className="shared-brand__name">Diário de Patas</span>
          <span className="shared-brand__tag">Sempre juntos</span>
        </span>
      </Link>
      <Link href={SIGNUP} className="shared-top__cta">Criar meu diário</Link>
    </header>
  );
}

/** Convite para quem recebeu o link: o diário do próprio cachorro, grátis. */
function Invite() {
  return (
    <section className="shared-invite" aria-labelledby="convite">
      <div className="shared-invite__art" aria-hidden="true"><AbuMascot width={120} /></div>
      <div className="stack" style={{ gap: 8 }}>
        <h2 id="convite">Seu cachorro também merece um diário</h2>
        <p>Guarde as fotos, cumpra missões divertidas, acompanhe vacinas e transforme momentos em arte. Tudo privado, só seu, até você decidir compartilhar.</p>
        <Link href={SIGNUP} className="shared-btn"><Paw size={18} /> Criar meu diário grátis</Link>
        <span className="shared-invite__note">Sem senha · entre com Google, Apple ou email</span>
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

  if (!share) {
    return (
      <div className="shared">
        <Brand />
        <main className="shared-main">
          <section className="shared-empty">
            <AbuMascot width={140} className="anim-float" />
            <h1>Este álbum não está disponível</h1>
            <p>O link pode ter sido desativado por quem compartilhou ou não existir mais.</p>
          </section>
          <Invite />
        </main>
        <footer className="shared-foot">Diário de Patas · Sempre juntos</footer>
      </div>
    );
  }

  const dates = share.entries.map((e) => e.occurredDate).sort();
  const range = dates.length ? (dates[0] === dates[dates.length - 1] ? formatCivilDate(dates[0]) : `${formatCivilDate(dates[0])} a ${formatCivilDate(dates[dates.length - 1])}`) : "";

  return (
    <div className="shared">
      <Brand />
      <main className="shared-main">
        <section className="shared-hero">
          {share.avatar ? (
            <span className="shared-avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/s/${token}/perfil`} alt="Foto de perfil" style={share.avatar.crop ? { objectPosition: `${share.avatar.crop.x}% ${share.avatar.crop.y}%`, transform: `scale(${share.avatar.crop.zoom})`, transformOrigin: `${share.avatar.crop.x}% ${share.avatar.crop.y}%` } : undefined} />
            </span>
          ) : null}
          <span className="shared-hero__kicker"><Paw size={16} /> Álbum compartilhado com você</span>
          <h1>{share.title}</h1>
          <p>{share.entries.length} {share.entries.length === 1 ? "lembrança" : "lembranças"}{range ? ` · ${range}` : ""}</p>
        </section>

        <section className={`shared-grid${share.entries.length === 1 ? " shared-grid--one" : ""}`} aria-label="Fotos do álbum">
          {share.entries.map((e, i) => (
            <figure key={e.id} className="shared-photo" style={{ rotate: `${[-1.2, 0.9, -0.5, 1.3][i % 4]}deg` }}>
              <span className="shared-photo__tape" aria-hidden="true" />
              <a href={`/s/${token}/foto/${e.id}`} target="_blank" rel="noopener" aria-label={`Abrir foto${e.caption ? `: ${e.caption}` : ""} em tamanho grande`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/s/${token}/foto/${e.id}`} alt={e.caption ? `Foto: ${e.caption}` : "Foto do álbum"} loading={i < 4 ? "eager" : "lazy"} decoding="async" />
              </a>
              <figcaption>
                {e.caption ? <span className="shared-photo__note">{e.caption}</span> : null}
                <span className="shared-photo__date">{formatCivilDate(e.occurredDate)}</span>
              </figcaption>
            </figure>
          ))}
        </section>

        <Invite />
      </main>
      <footer className="shared-foot">
        Feito com carinho no <Link href={SIGNUP}>Diário de Patas</Link> · Este álbum é privado e só pode ser visto por quem tem o link.
      </footer>
    </div>
  );
}
