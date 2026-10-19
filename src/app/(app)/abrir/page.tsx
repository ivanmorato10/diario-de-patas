"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/data/store";
import { switchDog } from "@/data/family-client";
import { PageLoading, TopBar } from "@/components/shell";

/**
 * Destino dos avisos (sininho e push): /abrir?cao=<cachorro>&foto=<id> ou &carta=<id>.
 * Confere o acesso, abre o diário CERTO e só então mostra a lembrança. Se o acesso foi removido ou a
 * lembrança foi apagada, explica em vez de levar para o lugar errado.
 */
function Abrir() {
  const params = useSearchParams();
  const router = useRouter();
  const { snap, reload } = useStore();
  const [problem, setProblem] = useState<string | null>(null);
  const t = useTranslations("open");
  const switching = useRef(false);
  // Sempre busca dados novos antes de procurar: uma foto recém-guardada não pode parecer "apagada".
  const [fresh, setFresh] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const load = useCallback(() => {
    setLoadFailed(false);
    reload().then(() => setFresh(true), () => setLoadFailed(true)); // só "atualizado" com sucesso
  }, [reload]);
  useEffect(() => { load(); }, [load]);
  const cao = params.get("cao");
  const foto = params.get("foto");
  const carta = params.get("carta");

  useEffect(() => {
    if (!snap || problem || !fresh) return;
    if (!cao) { router.replace("/novidades"); return; }
    if (snap.dog?.id !== cao) {
      if (switching.current) return; // esperando o diário certo carregar
      if (!(snap.diaries ?? []).some((d) => d.id === cao)) { setProblem(t("noAccess")); return; }
      switching.current = true;
      switchDog(cao).then(() => reload()).catch(() => setProblem(t("openFailed")));
      return;
    }
    // Já no cachorro certo: a lembrança ainda existe?
    if (foto && !snap.entries.some((e) => e.id === foto)) { setProblem(t("photoDeleted")); return; }
    if (carta && !(snap.letters ?? []).some((l) => l.id === carta)) { setProblem(t("letterDeleted")); return; }
    router.replace(foto ? `/diario?ir=${foto}` : carta ? `/diario?ir=carta-${carta}` : "/diario");
  }, [snap, problem, fresh, cao, foto, carta, reload, router, t]);

  if (loadFailed) {
    return (
      <>
        <TopBar title={t("title")} back="/novidades" emoji="🔔" />
        <main className="main">
          <p className="page-note">{t("loadFailed")}</p>
          <button type="button" className="btn btn--secondary btn--block" onClick={load}>{t("retry")}</button>
        </main>
      </>
    );
  }
  if (problem) {
    return (
      <>
        <TopBar title={t("title")} back="/novidades" emoji="🔔" />
        <main className="main">
          <p className="page-note">{problem}</p>
          <Link href="/novidades" className="btn btn--secondary btn--block">{t("back")}</Link>
        </main>
      </>
    );
  }
  return <main className="main"><PageLoading /></main>;
}

export default function AbrirPage() {
  return (
    <Suspense fallback={null}>
      <Abrir />
    </Suspense>
  );
}
