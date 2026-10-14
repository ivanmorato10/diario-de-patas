"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { openDemoDb, type Snapshot } from "./demo-repository";
import { demoRepository } from "./demo-adapter";
import { realRepository } from "./real-repository";
import type { Repository } from "./repository";
import type { CycleContext } from "@/domain/cycle";
import { REAL_MODE } from "@/config/mode";

interface StoreValue {
  /** Dados: IndexedDB (demonstração) ou conta real, pela mesma interface. */
  repo: Repository | null;
  snap: Snapshot | null;
  /** Demo: IndexedDB indisponível (ex.: navegação privada). Real: não deu para carregar a conta. */
  unavailable: boolean;
  reload: () => Promise<void>;
  /** Atualização otimista: muda a tela na hora, antes da resposta do servidor (o reload confirma depois). */
  patchSnap: (fn: (s: Snapshot) => Snapshot) => void;
  /** Demo: apaga o diário deste aparelho. Real: exclui a conta. */
  reset: () => Promise<void>;
}

const Ctx = createContext<StoreValue | null>(null);

/** Avisa as outras abas abertas do app quando o diário é apagado. */
const CHANNEL = "ddp-store";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const repoRef = useRef<Repository | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = REAL_MODE ? realRepository() : demoRepository(await openDemoDb());
      if (!alive) return;
      repoRef.current = r;
      setRepo(r);
      setSnap(await r.loadSnapshot());
    })().catch(() => alive && setUnavailable(true));
    return () => {
      alive = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (repoRef.current) setSnap(await repoRef.current.loadSnapshot());
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e) => {
      if (e.data === "reset") void reload();
    };
    return () => ch.close();
  }, [reload]);

  const reset = useCallback(async () => {
    if (!repoRef.current) return;
    await repoRef.current.wipe();
    await reload().catch(() => setSnap(null));
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(CHANNEL);
      ch.postMessage("reset");
      ch.close();
    }
  }, [reload]);

  const patchSnap = useCallback((fn: (s: Snapshot) => Snapshot) => setSnap((s) => (s ? fn(s) : s)), []);
  const value = useMemo(() => ({ repo, snap, unavailable, reload, reset, patchSnap }), [repo, snap, unavailable, reload, reset, patchSnap]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore fora do StoreProvider");
  return v;
}

/** URL temporária de um Blob, revogada ao desmontar. */
export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** Arquivo de uma foto do diário: undefined = carregando, null = indisponível. */
export function useMediaBlob(id: string | null | undefined, variant: "thumb" | "display"): Blob | null | undefined {
  const { repo } = useStore();
  const [b, setB] = useState<Blob | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!repo || !id) {
      setB(id ? undefined : null);
      return;
    }
    setB(undefined);
    repo.getMediaBlob(id, variant).then((r) => alive && setB(r), () => alive && setB(null));
    return () => {
      alive = false;
    };
  }, [repo, id, variant]);
  return b;
}

/** Contexto do ciclo de missões a partir do snapshot (§7). */
export function cycleContext(snap: Snapshot): CycleContext | null {
  if (!snap.dog) return null;
  return {
    dogId: snap.dog.id, dogName: snap.dog.name, birthDate: snap.dog.birthDate, today: snap.today,
    plan: snap.dailyPlan, completions: snap.completions, advances: snap.collectionAdvances,
  };
}
