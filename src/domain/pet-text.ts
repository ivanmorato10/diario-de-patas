/**
 * Textos pessoais: troca "o cachorro", "seu cachorro" etc. pelo nome do cachorro na hora de mostrar.
 * O catálogo continua genérico (é ele que o servidor usa para conferir as fotos).
 * Plural ("dois cachorros") fica como está, e "cachorro" genérico ("outro cachorro", "um cachorro") também:
 * só o cachorro da pessoa vira o nome.
 */
/** Palavras que tornam "cachorro" genérico (não é o cachorro da pessoa). Sem lookbehind: Safari antigo não suporta. */
const GENERIC_BEFORE = /(?:^|[\s(])(?:outro|outra|um|uma|algum|nenhum|qualquer|cada|todo|novo|mesmo|esse|este|aquele)\s+$/i;
const PREP: Record<string, string> = { no: "em", do: "de", ao: "a", pelo: "por" };
const RULES: [RegExp, (n: string, m: RegExpMatchArray) => string][] = [
  [/\b(no|do|ao|pelo)(?: seu)? cachorro\b(?!s)/g, (n, m) => `${PREP[m[1]]} ${n}`],
  [/\b(?:[Oo] )?[Ss]eu cachorro\b(?!s)/g, (n) => n],
  [/\b[Oo] cachorro\b(?!s)/g, (n) => n],
  [/\b[Cc]achorro\b(?!s)/g, (n) => n],
];

export function petText(text: string, name: string | null | undefined): string {
  const n = name?.trim();
  if (!n || !text) return text;
  return RULES.reduce((t, [re, f]) => t.replace(re, (...m) => {
    const offset = m[m.length - 2] as number, whole = m[m.length - 1] as string;
    if (GENERIC_BEFORE.test(whole.slice(Math.max(0, offset - 20), offset))) return m[0] as string;
    return f(n, m as unknown as RegExpMatchArray);
  }), text);
}
