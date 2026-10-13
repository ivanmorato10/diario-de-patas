/**
 * Clientes Supabase do SERVIDOR (MUDANCAS-V2 §8).
 * - userClient: sessão do usuário pelos cookies — as políticas RLS valem (defesa extra).
 * - adminClient: chave secreta, só para operações que o servidor autoriza explicitamente
 *   (XP, uploads, exclusão). Nunca importar este arquivo em código de navegador.
 */
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config/mode";

export async function userClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
  admin ??= createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

/** Usuário da sessão, conferido no servidor do Supabase (não confia só no cookie). */
export async function requireUser() {
  const supa = await userClient();
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "UNAUTHENTICATED", "Entre na sua conta para continuar.");
  return { user: data.user, supa };
}
