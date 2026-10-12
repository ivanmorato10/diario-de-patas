import Link from "next/link";
import { NotebookMark } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="main main--bare" style={{ alignItems: "center", textAlign: "center", paddingTop: 64 }}>
      <NotebookMark size={56} />
      <h1>Página não encontrada</h1>
      <p className="muted">Essa página não existe ou mudou de lugar.</p>
      <Link href="/" className="btn btn--primary">Voltar ao diário</Link>
    </main>
  );
}
