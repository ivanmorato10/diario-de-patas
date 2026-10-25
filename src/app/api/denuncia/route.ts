/** Denúncia de álbum público (/s/<token>), sem conta: registra e avisa o suporte. Mesma origem; limite por álbum. */
import { NextResponse } from "next/server";
import { HttpError, adminClient } from "@/server/supabase";
import { requestLocale, translateKey, translator } from "@/server/i18n";
import { sha256hex } from "@/server/rpc";
import { reportShare } from "@/server/safety";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const t = translator(await requestLocale());
  const fail = (status: number, code: string, key: string) => NextResponse.json({ code, message: translateKey(t, key) }, { status });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return fail(403, "FORBIDDEN", "errors.badOrigin");
  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token ?? "";
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return fail(404, "NOT_FOUND", "errors.notFoundShort");
  try {
    // Mesmo revogado o álbum pode ser denunciado (quem denuncia pode ter guardado o que viu).
    const { data } = await adminClient().from("share_links").select("id, dog_id").eq("token_hash", await sha256hex(token)).maybeSingle();
    if (!data) return fail(404, "NOT_FOUND", "errors.notFoundShort");
    const r = await reportShare((data as any).id, (data as any).dog_id ?? null, body);
    return NextResponse.json(r, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.code, e.message);
    console.error("denúncia de álbum", e);
    return fail(500, "SERVER", "errors.generic");
  }
}
