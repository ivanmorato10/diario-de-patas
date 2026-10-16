/** Configuração faltando: responde "indisponível" (sem modo demonstração) e registra o erro técnico uma vez. */
import "server-only";
import { NextResponse } from "next/server";
import { CONFIG_OK, UNAVAILABLE_TEXT } from "@/config/mode";

let logged = false;
export function configMissing(): NextResponse | null {
  if (CONFIG_OK) return null;
  if (!logged) {
    logged = true;
    console.error("CONFIGURAÇÃO AUSENTE: NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY não definidas. O app responde 'indisponível'.");
  }
  return NextResponse.json({ code: "UNAVAILABLE", message: UNAVAILABLE_TEXT }, { status: 503 });
}
