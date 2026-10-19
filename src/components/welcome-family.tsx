"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("welcomeFamily");
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
        <h2 id="welcome-family-title">{t("title", { dog: dog.name })}</h2>
        <p className="page-note" style={{ margin: 0 }}>{t("text", { dog: dog.name })}</p>
      </div>
      <InviteBox dogName={dog.name} />
      <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={close}>{t("notNow")}</button>
      <p className="caption" style={{ textAlign: "center", marginTop: 6 }}>{t("later")}</p>
    </Sheet>
  );
}
