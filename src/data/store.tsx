"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getMedia, loadSnapshot, openDemoDb, resetDemo, type Db, type Snapshot } from "./demo-repository";
import type { MediaAsset } from "@/domain/types";

interface StoreValue {
  db: Db | null;
  snap: Snapshot | null;
  /** IndexedDB indisponível (ex.: navegação privada em alguns navegadores). */
  unavailable: boolean;
  reload: () => Promise<void>;
  reset: () => Promise<void>;
}

const Ctx = createContext<StoreValue | null>(null);

/** Avisa as outras abas abertas do app quando o diário é apagado. */
const CHANNEL = "ddp-store";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const dbRef = useRef<Db | null>(null);

  useEffect(() => {
    let alive = true;
    openDemoDb()
      .then(async (d) => {
        if (!alive) return;
        dbRef.current = d;
        setDb(d);
        setSnap(await loadSnapshot(d));
      })
      .catch(() => alive && setUnavailable(true));
    return () => {
      alive = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (dbRef.current) setSnap(await loadSnapshot(dbRef.current));
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
    if (!dbRef.current) return;
    await resetDemo(dbRef.current);
    await reload();
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(CHANNEL);
      ch.postMessage("reset");
      ch.close();
    }
  }, [reload]);

  const value = useMemo(() => ({ db, snap, unavailable, reload, reset }), [db, snap, unavailable, reload, reset]);
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

export function useMedia(id: string | null | undefined): MediaAsset | null | undefined {
  const { db } = useStore();
  const [m, setM] = useState<MediaAsset | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!db || !id) {
      setM(id ? undefined : null);
      return;
    }
    getMedia(db, id).then((r) => alive && setM(r ?? null));
    return () => {
      alive = false;
    };
  }, [db, id]);
  return m;
}
