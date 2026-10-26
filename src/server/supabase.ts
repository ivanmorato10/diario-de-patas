/**
 * Clientes Supabase do SERVIDOR (MUDANCAS-V2 §8).
 * - userClient: sessão do usuário pelos cookies — as políticas RLS valem (defesa extra).
 * - adminClient: chave secreta, só para operações que o servidor autoriza explicitamente
 *   (XP, uploads, exclusão). Nunca importar este arquivo em código de navegador.
 */
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config/mode";
import { perfOn, timedFetch } from "./timing";

export async function userClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...(perfOn() ? { global: { fetch: timedFetch } } : {}),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Em Server Components os cookies são só leitura; o proxy renova a sessão.
        }
      },
    },
  });
}

let admin: SupabaseClient | null = null;
export function adminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  admin ??= createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false }, ...(perfOn() ? { global: { fetch: timedFetch } } : {}) });
  return admin;
}

/**
 * Erro de regra com status HTTP. `message` é uma CHAVE dos arquivos de idioma (ex.: "errors.albumNotFound"),
 * com `params` para os valores; a rota traduz no idioma de quem pediu.
 */
export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly params?: Record<string, string | number>) {
    super(message);
  }
}

/**
 * Usuário da sessão. A sessão é conferida pela assinatura do token (chaves assimétricas do Supabase, conferidas aqui
 * sem ida ao servidor de login): cada operação do app fica uma viagem mais rápida. O banco confere o mesmo token
 * em toda consulta (RLS). Só o que o token traz: id, email e metadados do login.
 */
export async function requireUser() {
  const supa = await userClient();
  const { data, error } = await supa.auth.getClaims();
  const c = data?.claims as { sub?: string; email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } | undefined;
  if (error || !c?.sub) throw new HttpError(401, "UNAUTHENTICATED", "errors.unauthenticated");
  const user = { id: c.sub, email: c.email, user_metadata: c.user_metadata ?? {}, app_metadata: c.app_metadata ?? {}, aud: "authenticated", created_at: "" } as User;
  return { user, supa };
}
