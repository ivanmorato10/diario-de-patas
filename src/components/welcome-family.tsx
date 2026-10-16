"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { Sheet } from "./entry-actions";
import { InviteBox } from "./invite-box";
import { AbuMascot } from "./brand";

/**
 * Logo depois de criar o PRIMEIRO diário (/hoje?bemvindo=1): o Abu apresenta o diário de família e já
 * deixa gerar o convite. Aparece uma vez; "Agora não" fecha e o convite continua em Perfil › Família.
 */
export function WelcomeFamily() {
  const { snap } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("bemvindo") === "1") setOpen(true);
  }, []);
  const dog = snap?.dog;
  if (!dog || snap?.role !== "admin") return null;

  function close() {
    setOpen(false);
    router.replace("/hoje"); // tira o ?bemvindo=1 para não abrir de novo
  }

  return (
    <Sheet open={open} onClose={close} labelledBy="welcome-family-title">
      <div className="welcome-family">
        <AbuMascot width={84} />
        <h2 id="welcome-family-title">O diário de {dog.name} está pronto! 🐾</h2>
        <p className="page-note" style={{ margin: 0 }}>Quem mais ama {dog.name}? Chame a família: cada pessoa entra com a própria conta e guarda fotos, escreve cartinhas e dá ossinho com você.</p>
      </div>
      <InviteBox dogName={dog.name} />
      <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={close}>Agora não</button>
      <p className="caption" style={{ textAlign: "center", marginTop: 6 }}>Dá para convidar depois em Perfil › Família.</p>
    </Sheet>
  );
}
