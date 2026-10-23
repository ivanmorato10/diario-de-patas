"use client";

/**
 * Consulta periódica sem acúmulo: a próxima só começa depois que a anterior terminou; pausa com a tela escondida
 * (volta ao ficar visível); depois de falhas, espera mais (até 1 min). `step` devolve true para parar.
 */
import { useEffect, useRef } from "react";

export function usePoll(step: () => Promise<boolean | void>, intervalMs: number, active: boolean) {
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wait = intervalMs;
    const schedule = (ms: number) => { if (!stopped) timer = setTimeout(run, ms); };
    const onVisible = () => { if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", onVisible); schedule(0); } };
    async function run() {
      if (stopped) return;
      if (document.visibilityState !== "visible") { document.addEventListener("visibilitychange", onVisible); return; }
      try {
        if (await stepRef.current()) return; // terminou
        wait = intervalMs;
      } catch {
        wait = Math.min(wait * 2, 60_000);
      }
      schedule(wait);
    }
    schedule(0);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [intervalMs, active]);
}
