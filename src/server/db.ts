/**
 * Resultado do banco conferido. O Supabase devolve { data, error }: uma Promise resolvida NÃO quer dizer que gravou.
 * - `must`: erro vira resposta de erro (500, com mensagem para a tela); nunca sucesso falso, lista vazia ou zero.
 * - `mustRow`: alteração que precisa achar a linha (com .select()): nenhuma linha = NOT_FOUND.
 */
import "server-only";
import { HttpError } from "./supabase";

type Result<T> = PromiseLike<{ data: T; error: { message?: string; code?: string } | null }>;

export async function must<T>(p: Result<T>, key = "errors.saveFailed"): Promise<T> {
  const { data, error } = await p;
  if (error) {
    console.error("banco:", error.code ?? "", error.message ?? "");
    throw new HttpError(500, "SERVER", key);
  }
  return data;
}

export async function mustRow<T>(p: Result<T[] | null>, notFoundKey = "errors.notFoundShort", key = "errors.saveFailed"): Promise<T> {
  const rows = await must(p, key);
  if (!rows || rows.length === 0) throw new HttpError(404, "NOT_FOUND", notFoundKey);
  return rows[0];
}
