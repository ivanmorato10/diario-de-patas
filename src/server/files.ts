/** Entrega de arquivos privados: confere o dono pela sessão (RLS) e lê o bucket com a chave do servidor. */
import "server-only";
import { NextResponse } from "next/server";
import { REAL_MODE } from "@/config/mode";
import { adminClient, HttpError, requireUser } from "./supabase";

export async function serveOwnFile(table: "media_assets" | "documents", bucket: "media" | "documents", id: string, variant: string) {
  if (!REAL_MODE) return new NextResponse(null, { status: 404 });
  try {
    const { supa } = await requireUser();
    const { data: row } = await supa.from(table).select("private_storage_key, thumb_storage_key, mime, status").eq("id", id).maybeSingle();
    if (!row || row.status !== "ready") return new NextResponse(null, { status: 404 });
    const key = variant === "thumb" ? row.thumb_storage_key : row.private_storage_key;
    if (!key) return new NextResponse(null, { status: 404 });
    const { data, error } = await adminClient().storage.from(bucket).download(key);
    if (error || !data) return new NextResponse(null, { status: 404 });
    return new NextResponse(data, {
      headers: {
        "content-type": variant === "thumb" && table === "documents" && row.mime === "application/pdf" ? "image/webp" : data.type || row.mime,
        "cache-control": "private, max-age=600", // só no navegador do dono; nunca em CDN
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    return new NextResponse(null, { status: e instanceof HttpError ? e.status : 500 });
  }
}
