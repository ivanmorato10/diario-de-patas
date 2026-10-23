/**
 * Página pública de um documento legal (Termos, Privacidade, Reembolso), no idioma de quem lê.
 * O texto vem de src/content/legal.ts; aqui só o formato simples dele: parágrafos, **negrito**, listas e tabelas.
 */
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { TopBar } from "@/components/shell";
import { LEGAL, LEGAL_PATHS, type LegalDoc } from "@/content/legal";
import type { AppLocale } from "@/i18n/locale";

/** **negrito** dentro do texto (o resto é texto puro: o React escapa tudo). */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
}

function Block({ src }: { src: string }) {
  const lines = src.split("\n");
  if (lines.every((l) => l.startsWith("|"))) {
    const cells = (l: string) => l.slice(1, -1).split("|").map((c) => c.trim());
    const [head, , ...rows] = lines;
    return (
      <div className="legal__table">
        <table className="data-table">
          <thead><tr>{cells(head).map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r}>{cells(r).map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  if (lines.every((l) => l.startsWith("- "))) return <ul>{lines.map((l) => <li key={l}>{inline(l.slice(2))}</li>)}</ul>;
  return <p>{inline(src)}</p>;
}

export const legalTitle = async (doc: LegalDoc) => LEGAL[(await getLocale()) as AppLocale][doc].title;

export async function LegalPage({ doc }: { doc: LegalDoc }) {
  const locale = (await getLocale()) as AppLocale;
  const all = LEGAL[locale];
  const { title, body } = all[doc];
  return (
    <div className="shell">
      <TopBar title={title} back="/sobre" backHistory emoji="📄" />
      <main className="main">
        <article className="card legal" lang={locale}>
          {body.split(/\n\s*\n/).map((b) => <Block key={b.slice(0, 40)} src={b.trim()} />)}
        </article>
        <nav className="legal__nav" aria-label={locale === "en" ? "Legal documents" : "Documentos"}>
          {(Object.keys(LEGAL_PATHS) as LegalDoc[]).filter((d) => d !== doc).map((d) => <Link key={d} href={LEGAL_PATHS[d]}>{all[d].title}</Link>)}
        </nav>
      </main>
    </div>
  );
}
