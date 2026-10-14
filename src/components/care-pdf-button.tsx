"use client";

import { useState } from "react";
import { useStore } from "@/data/store";

/** Gera a ficha de cuidados em PDF no aparelho e abre o compartilhar (WhatsApp, email…) ou baixa o arquivo. */
export function CarePdfButton() {
  const { snap } = useStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!snap?.dog) return null;

  async function make() {
    if (!snap?.dog) return;
    setBusy(true);
    setMsg(null);
    try {
      const { buildCarePdf } = await import("@/lib/care-pdf");
      const logoPng = await fetch("/brand/favicon-64.png").then((r) => r.arrayBuffer()).catch(() => null);
      const bytes = await buildCarePdf({ dogName: snap.dog.name, birthDate: snap.dog.birthDate, today: snap.today, health: snap.health, logoPng });
      const name = `ficha-de-cuidados-${snap.dog.name.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase()}.pdf`;
      const file = new File([bytes as BlobPart], name, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Ficha de cuidados de ${snap.dog.name}` }).catch(() => undefined);
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setMsg("PDF baixado.");
      }
    } catch {
      setMsg("Não conseguimos gerar o PDF. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 4 }}>
      <button type="button" className="btn btn--secondary btn--block" onClick={make} disabled={busy}>📄 {busy ? "Gerando PDF…" : "PDF para o veterinário"}</button>
      <span className="caption" style={{ textAlign: "center" }}>{msg ?? "Ficha com peso, vacinas, remédios, consultas e contatos, pronta para mandar."}</span>
    </div>
  );
}
