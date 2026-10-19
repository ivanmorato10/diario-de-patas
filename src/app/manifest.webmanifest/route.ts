/**
 * Manifesto do app instalável, no idioma de quem instala (o nome da marca é o mesmo nos dois idiomas).
 * Sempre conferido com o servidor (next.config.ts: Cache-Control no-cache).
 */
import { NextResponse } from "next/server";
import { requestLocale, translator } from "@/server/i18n";

export const dynamic = "force-dynamic";

export async function GET() {
  const locale = await requestLocale();
  const t = translator(locale);
  return NextResponse.json({
    id: "/",
    name: "Diário de Patas",
    short_name: "Diário de Patas",
    description: t("meta.description"),
    lang: locale,
    dir: "ltr",
    start_url: "/?origem=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#63B4AD",
    theme_color: "#63B4AD",
    categories: ["lifestyle", "photo"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }, { headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "no-cache" } });
}
