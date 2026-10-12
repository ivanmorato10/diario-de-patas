import type { Metadata } from "next";
import { NotebookMark } from "@/components/brand";

export const metadata: Metadata = {
  title: "Álbum compartilhado",
  robots: { index: false, follow: false },
};

/**
 * Página compartilhada (§8.10). Sem servidor de compartilhamento configurado,
 * todo token resolve para a mensagem neutra — sem revelar se existiu ou de quem é.
 * Etapa C: resolver hash do token → seleção → mídia via rota que revalida o link.
 */
export default function SharedPage() {
  return (
    <main className="main main--bare" style={{ alignItems: "center", textAlign: "center", paddingTop: 64 }}>
      <NotebookMark size={56} />
      <h1>Este álbum não está disponível</h1>
      <p className="muted">O link pode ter sido desativado ou não existir mais.</p>
      <p className="caption">Diário de Patas</p>
    </main>
  );
}
