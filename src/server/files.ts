/**
 * Entrega de arquivos privados: confere o dono pela sessão (RLS) e lê o bucket com a chave do servidor.
 * Rápido de propósito (cada foto da tela passa aqui): a sessão é conferida pela assinatura do token, sem ida ao
 * servidor de login (o banco confere o mesmo token na consulta com RLS), e o arquivo, que nunca muda para o mesmo
 * id, fica guardado no navegador do dono (as próximas aberturas do app mostram as fotos na hora).
 */
import "server-only";
import { NextResponse } from "next/server";
import { configMissing } from "@/server/config-check";
import { adminClient, HttpError, userClient } from "./supabase";

export async function serveOwnFile(table: "media_assets" | "documents", bucket: "media" | "documents", id: string, variant: string) {
  if (configMissing()) return new NextResponse(null, { status: 503 });
  try {
    const supa = await userClient();
    const { data: claims } = await supa.auth.getClaims();
    if (!claims?.claims?.sub) return new NextResponse(null, { status: 401 });
    const { data: row } = await supa.from(table).select("private_storage_key, thumb_storage_key, mime, status").eq("id", id).maybeSingle();
    if (!row || row.status !== "ready") return new NextResponse(null, { status: 404 });
    const key = variant === "thumb" ? row.thumb_storage_key : row.private_storage_key;
    if (!key) return new NextResponse(null, { status: 404 });
    const { data, error } = await adminClient().storage.from(bucket).download(key);
    if (error || !data) return new NextResponse(null, { status: 404 });
    return new NextResponse(data, {
      headers: {
        "content-type": variant === "thumb" && table === "documents" && row.mime === "application/pdf" ? "image/webp" : data.type || row.mime,
        // Só no navegador de quem pode ver (nunca em CDN). O conteúdo de um id não muda (foto nova = id novo);
        // ao sair da conta, /auth/sair limpa esse cache.
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    return new NextResponse(null, { status: e instanceof HttpError ? e.status : 500 });
  }
}
