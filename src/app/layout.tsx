import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { StoreProvider } from "@/data/store";
import { ServiceWorker } from "@/components/service-worker";
import { NativeBridge } from "@/components/native-bridge";
import { OfflineBanner } from "@/components/install-app";
import { LocaleSync } from "@/components/locale-sync";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: "Diário de Patas", template: "%s · Diário de Patas" },
    description: t("description"),
    manifest: "/manifest.webmanifest",
    icons: { icon: "/brand/favicon-64.png", apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }] },
    // Tela de início do iPhone: abre sem a barra do navegador, com o nome curto e barra de status clara.
    appleWebApp: { capable: true, title: "Diário de Patas", statusBarStyle: "default" },
    other: { "mobile-web-app-capable": "yes", "apple-mobile-web-app-capable": "yes" },
    formatDetection: { telephone: false },
    // Conteúdo é privado: nada de pré-visualização com fotos em Open Graph (§12).
    openGraph: { title: "Diário de Patas", description: t("tagline") },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#63B4AD",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** O idioma vem do cookie (que espelha o perfil) já na primeira resposta: a página não troca de idioma ao carregar. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <StoreProvider>
            {children}
            <LocaleSync />
          </StoreProvider>
          <OfflineBanner />
          <ServiceWorker />
          <NativeBridge />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
