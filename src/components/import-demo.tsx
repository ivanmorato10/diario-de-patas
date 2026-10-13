"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REAL_MODE } from "@/config/mode";
import * as demo from "@/data/demo-repository";
import { importDemo, type DemoSource, type ImportReport } from "@/data/import-demo";
import { useStore } from "@/data/store";
import { IconBook } from "./icons";

/** Diário do modo demonstração guardado neste navegador (se houver). */
function useDemoDiary() {
  const [found, setFound] = useState<DemoSource | null>(null);
  useEffect(() => {
    if (!REAL_MODE) return;
    let alive = true;
    (async () => {
      const db = await demo.openDemoDb();
      const snap = await demo.loadSnapshot(db);
      if (alive && snap.dog && (snap.entries.length || snap.completions.length)) {
        setFound({ snap, getMedia: (id) => demo.getMedia(db, id), getDocumentFile: (id) => demo.getDocumentFile(db, id) });
      }
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return found;
}

const DISMISS = "ddp-import-dispensado";

/** Oferece trazer o diário deste aparelho para a conta — uma única vez, com confirmação (§8.2). */
export function ImportDemoCard() {
  const { repo, snap, reload } = useStore();
  const source = useDemoDiary();
  const [state, setState] = useState<"offer" | "confirm" | "running" | "done" | "error">("offer");
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(DISMISS) === "1";
    } catch {
      return false;
    }
  });

  if (!REAL_MODE || !source || !repo || !snap || dismissed) return null;
  if (snap.profile?.demoImportedAt && state !== "done") return null;
  const s = source.snap;

  async function run() {
    setState("running");
    try {
      setReport(await importDemo(source!, repo!, (d, t) => setProgress([d, t])));
      await reload();
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="card stack" aria-labelledby="import-title" style={{ borderColor: "var(--brand-teal)", borderWidth: 2, borderStyle: "solid" }}>
      <div className="row" style={{ gap: 10 }}>
        <span className="mission-stamp mission-stamp--done" aria-hidden="true"><IconBook /></span>
        <h2 id="import-title" style={{ fontSize: "1.0625rem" }}>{state === "done" ? "Diário trazido para a sua conta" : `O diário de ${s.dog!.name} está neste aparelho`}</h2>
      </div>
      {state === "offer" ? (
        <>
          <p className="small">Encontramos {s.entries.length} {s.entries.length === 1 ? "lembrança" : "lembranças"} do modo demonstração neste navegador. Quer trazer para a sua conta? Assim ele fica guardado e aparece em qualquer aparelho.</p>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <button type="button" className="btn btn--primary btn--small" onClick={() => setState("confirm")}>Trazer para a conta</button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => { try { localStorage.setItem(DISMISS, "1"); } catch { /* sem armazenamento */ } setDismissed(true); }}>Agora não</button>
          </div>
        </>
      ) : state === "confirm" ? (
        <>
          <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Vêm as fotos, legendas, álbuns, conquistas das missões, cuidados e documentos.</li>
            <li>O histórico das missões do dia (de dias que já passaram) não vem.</li>
            <li>É uma vez só. Se algo falhar no meio, dá para repetir sem duplicar.</li>
          </ul>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <button type="button" className="btn btn--primary btn--small" onClick={run}>Confirmar e trazer</button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setState("offer")}>Voltar</button>
          </div>
        </>
      ) : state === "running" ? (
        <div className="stack" aria-live="polite">
          <p className="small">Enviando… {progress[0]} de {progress[1]}</p>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress[1] || 1} aria-valuenow={progress[0]} aria-label="Progresso da importação"><span style={{ width: `${progress[1] ? (progress[0] / progress[1]) * 100 : 0}%` }} /></div>
          <p className="caption">Mantenha esta tela aberta até terminar.</p>
        </div>
      ) : state === "done" && report ? (
        <p className="small" role="status">{report.entries} {report.entries === 1 ? "lembrança" : "lembranças"}, {report.missions} {report.missions === 1 ? "conquista" : "conquistas"} e {report.documents} {report.documents === 1 ? "documento" : "documentos"} agora estão na sua conta.{report.failed ? ` ${report.failed} ${report.failed === 1 ? "item não pôde" : "itens não puderam"} ser trazidos.` : ""} A cópia deste aparelho continua aqui, intacta. <Link href="/hoje">Abrir o diário</Link></p>
      ) : (
        <div className="stack">
          <p className="field-error" role="alert">A importação parou no meio. Tente de novo — o que já foi não se repete.</p>
          <button type="button" className="btn btn--secondary btn--small" onClick={run}>Tentar de novo</button>
        </div>
      )}
    </section>
  );
}
