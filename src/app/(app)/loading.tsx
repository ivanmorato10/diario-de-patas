import { PageLoading } from "@/components/shell";

/**
 * Troca de tela instantânea: ao tocar num link, a tela nova aparece na hora com o esqueleto de carregamento,
 * em vez de a tela antiga ficar parada esperando o servidor (o que parecia "toque que não pegou").
 * Também deixa o Next pré-carregar as telas dos links visíveis.
 */
export default function Loading() {
  return <main className="main"><PageLoading /></main>;
}
