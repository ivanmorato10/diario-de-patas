"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import * as demo from "@/data/demo-repository";
import { importDemo, type DemoSource, type ImportReport } from "@/data/import-demo";
import { useStore } from "@/data/store";
import { IconBook } from "./icons";

/** Diário do modo demonstração guardado neste navegador (se houver). */
function useDemoDiary() {
  const [found, setFound] = useState<DemoSource | null>(null);
  useEffect(() => {
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
  const t = useTranslations("importDemo");
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

  if (!source || !repo || !snap || dismissed) return null;
  if (snap.profile?.demoImportedAt && state !== "done") return null;
  const s = source.snap;

  async function run() {
    setState("running");
    try {
      setReport(await importDemo(source!, repo!, (d, t) => setProgress([d, t])));
    } catch {
      setState("error");
      return;
    }
    setState("done");
    void reload().catch(() => undefined); // importou: a conferência da tela não vira "falhou"
  }

  return (
    <section className="card stack" aria-labelledby="import-title" style={{ borderColor: "var(--brand-teal)", borderWidth: 2, borderStyle: "solid" }}>
      <div className="row" style={{ gap: 10 }}>
        <span className="mission-stamp mission-stamp--done" aria-hidden="true"><IconBook /></span>
        <h2 id="import-title" style={{ fontSize: "1.0625rem" }}>{state === "done" ? t("doneTitle") : t("title", { dog: s.dog!.name })}</h2>
      </div>
      {state === "offer" ? (
        <>
          <p className="small">{t("offer", { count: s.entries.length })}</p>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <button type="button" className="btn btn--primary btn--small" onClick={() => setState("confirm")}>{t("bring")}</button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => { try { localStorage.setItem(DISMISS, "1"); } catch { /* sem armazenamento */ } setDismissed(true); }}>{t("notNow")}</button>
          </div>
        </>
      ) : state === "confirm" ? (
        <>
          <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
            <li>{t("what")}</li>
            <li>{t("notDaily")}</li>
            <li>{t("once")}</li>
          </ul>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <button type="button" className="btn btn--primary btn--small" onClick={run}>{t("confirm")}</button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setState("offer")}>{t("back")}</button>
          </div>
        </>
      ) : state === "running" ? (
        <div className="stack" aria-live="polite">
          <p className="small">{t("sending", { n: progress[0], total: progress[1] })}</p>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress[1] || 1} aria-valuenow={progress[0]} aria-label={t("progress")}><span style={{ width: `${progress[1] ? (progress[0] / progress[1]) * 100 : 0}%` }} /></div>
          <p className="caption">{t("keepOpen")}</p>
        </div>
      ) : state === "done" && report ? (
        <p className="small" role="status">{t("report", { entries: report.entries, missions: report.missions, documents: report.documents })}{report.failed ? ` ${t("failedItems", { count: report.failed })}` : ""} {t("copyStays")} <Link href="/hoje">{t("open")}</Link></p>
      ) : (
        <div className="stack">
          <p className="field-error" role="alert">{t("stopped")}</p>
          <button type="button" className="btn btn--secondary btn--small" onClick={run}>{t("retry")}</button>
        </div>
      )}
    </section>
  );
}
