/** Sair da conta. POST para não ser disparado por um link de outro site. */
import { NextResponse } from "next/server";
import { userClient } from "@/server/supabase";

export async function POST(req: Request) {
  const supa = await userClient();
  await supa.auth.signOut();
  return NextResponse.redirect(new URL("/bem-vindo", req.url), { status: 303 });
}
