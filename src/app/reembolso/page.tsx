import type { Metadata } from "next";
import { LegalPage, legalTitle } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${await legalTitle("reembolso")} · Diário de Patas` };
}

export default function Page() {
  return <LegalPage doc="reembolso" />;
}
