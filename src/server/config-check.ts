/** Configuração faltando: responde "indisponível" (sem modo demonstração) e registra o erro técnico uma vez. */
import "server-only";
import { NextResponse } from "next/server";
import { CONFIG_OK } from "@/config/mode";
import { DEFAULT_LOCALE, type AppLocale } from "@/i18n/locale";
import { translator } from "./i18n";

let logged = false;
export function configMissing(locale: AppLocale = DEFAULT_LOCALE): NextResponse | null {
  if (CONFIG_OK) return null;
  if (!logged) {
    logged = true;
    console.error("CONFIGURAÇÃO AUSENTE: NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY não definidas. O app responde 'indisponível'.");
  }
  return NextResponse.json({ code: "UNAVAILABLE", message: translator(locale)("shell.appUnavailable") }, { status: 503 });
}
