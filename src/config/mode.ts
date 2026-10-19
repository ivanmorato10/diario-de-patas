/**
 * Configuração pública do Supabase (embutida no build). O app só funciona com contas reais:
 * sem estas variáveis ele NÃO cai em modo demonstração — mostra "temporariamente indisponível"
 * e o servidor registra o erro (ver src/server/config-check.ts).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const CONFIG_OK = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
