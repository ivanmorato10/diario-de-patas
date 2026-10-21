/** Sair da conta. POST para não ser disparado por um link de outro site. */
import { NextResponse } from "next/server";
import { userClient } from "@/server/supabase";

export async function POST(req: Request) {
  const supa = await userClient();
  await supa.auth.signOut();
  const res = NextResponse.redirect(new URL("/entrar", req.url), { status: 303 });
  // Fotos e documentos ficam guardados no navegador para abrir rápido; ao sair, apaga (aparelho compartilhado).
  res.headers.set("Clear-Site-Data", '"cache"');
  return res;
}
