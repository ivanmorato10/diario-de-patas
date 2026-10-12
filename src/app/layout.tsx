import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/data/store";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Diário de Patas", template: "%s · Diário de Patas" },
  description: "Um diário com missões, fotos e lembranças do seu melhor amigo.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/favicon-64.png", apple: "/brand/apple-touch-icon.png" },
  // Conteúdo é privado: nada de pré-visualização com fotos em Open Graph (§12).
  openGraph: { title: "Diário de Patas", description: "Pequenas aventuras. Memórias para sempre." },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#63B4AD",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <StoreProvider>{children}</StoreProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
