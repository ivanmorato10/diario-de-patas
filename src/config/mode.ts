/**
 * Modo do app (MUDANCAS-V2 §8.1): com NEXT_PUBLIC_SUPABASE_URL definido roda com contas reais;
 * sem ela, em modo demonstração (tudo no navegador). Valores públicos — embutidos no build.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const REAL_MODE = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
