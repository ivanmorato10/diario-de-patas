import type { Metadata } from "next";
import { AbuMascot } from "@/components/brand";
import { REAL_MODE } from "@/config/mode";
import { formatCivilDate } from "@/domain/dates";
import { resolveShare } from "@/server/rpc";

export const dynamic = "force-dynamic"; // revogar precisa valer na hora: nada em cache
// Nada privado no Open Graph: título genérico, sem foto nem nome do cachorro (briefing §12).
export const metadata: Metadata = {
  title: "Álbum compartilhado",
  robots: { index: false, follow: false },
};

/**
 * Página compartilhada (briefing §8.10, §12): só a seleção escolhida pelo dono, somente leitura,
 * sem login. Link inexistente, revogado ou expirado → a mesma mensagem neutra (não revela se existiu).
 */
export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = REAL_MODE ? await resolveShare(token).catch(() => null) : null;
  if (!share) {
    return (
      <main className="main main--bare" style={{ alignItems: "center", textAlign: "center", paddingTop: 64 }}>
        <AbuMascot width={150} className="anim-float" />
        <h1>Este álbum não está disponível</h1>
        <p className="muted">O link pode ter sido desativado ou não existir mais.</p>
        <p className="caption">Diário de Patas</p>
      </main>
    );
  }
  return (
    <main className="main main--bare stack-lg" style={{ paddingTop: 24 }}>
      <header className="stack" style={{ textAlign: "center", alignItems: "center" }}>
        <h1 style={{ overflowWrap: "anywhere" }}>{share.title}</h1>
        <p className="caption">{share.entries.length} {share.entries.length === 1 ? "lembrança" : "lembranças"} · Diário de Patas</p>
      </header>
      {share.entries.map((e, i) => (
        <figure key={e.id} className="polaroid" style={{ margin: "6px 4px 14px", rotate: `${i % 2 ? 0.8 : -0.8}deg` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/s/${token}/foto/${e.id}`} alt={e.caption ? `Foto: ${e.caption}` : "Foto do álbum"} className="photo" loading="lazy" decoding="async" />
          <figcaption className="stack" style={{ gap: 2, padding: "8px 4px 4px" }}>
            {e.caption ? <span className="polaroid__note">{e.caption}</span> : null}
            <span className="caption">{formatCivilDate(e.occurredDate)}</span>
          </figcaption>
        </figure>
      ))}
      <p className="caption" style={{ textAlign: "center" }}>Diário de Patas · Sempre Juntos</p>
    </main>
  );
}
