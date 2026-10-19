/**
 * Mensagens que viajam como chave (erros de regra e de validação): "validation.maxChars?max=80".
 * O texto é montado só na hora de mostrar, no idioma de quem lê.
 */
export function splitKey(raw: string): { key: string; params: Record<string, string | number> } {
  const i = raw.indexOf("?");
  if (i < 0) return { key: raw, params: {} };
  const params: Record<string, string | number> = {};
  for (const [k, v] of new URLSearchParams(raw.slice(i + 1))) params[k] = /^\d+(\.\d+)?$/.test(v) ? Number(v) : v;
  return { key: raw.slice(0, i), params };
}

/** Parece uma chave do app (e não um texto já traduzido vindo do servidor). */
export const looksLikeKey = (s: string) => /^[a-zA-Z]+\.[\w.-]+(\?.*)?$/.test(s);

/** Traduz uma chave com um tradutor qualquer (tela ou servidor); texto comum volta como está. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function textOf(t: { has: (k: any) => boolean } & ((k: any, p?: any) => string), raw: string, extra?: Record<string, string | number>): string {
  if (!looksLikeKey(raw)) return raw;
  const { key, params } = splitKey(raw);
  return t.has(key) ? t(key, { ...params, ...extra }) : raw;
}

/**
 * Tradutor sem checagem de tipo da chave, para chaves montadas em tempo de execução (ids do catálogo, passos).
 * A existência de cada uma é garantida pelos testes de paridade e de cobertura do catálogo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const loose = (t: (...a: any[]) => any) => t as unknown as ((key: string, values?: Record<string, string | number | Date>) => string) & { has: (key: string) => boolean; rich: (key: string, values?: Record<string, unknown>) => React.ReactNode };
