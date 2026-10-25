"use client";

import { needsComposite, saveComposite } from "@/lib/studio-composite";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DomainError, type Snapshot } from "./demo-repository";
import { getActiveDog, realRepository, setActiveDog } from "./real-repository";
import { syncDeviceOwner } from "./push-client";
import { pendingArts, studioJob, untrackArt, type StudioJob } from "./studio-client";
import type { Repository } from "./repository";
import type { CycleContext } from "@/domain/cycle";
import { CONFIG_OK } from "@/config/mode";
import type { Region } from "@/i18n/locale";

interface StoreValue {
  /** Dados da conta (Supabase). */
  repo: Repository | null;
  snap: Snapshot | null;
  /** Demo: IndexedDB indisponível (ex.: navegação privada). Real: não deu para carregar a conta. */
  unavailable: boolean;
  reload: () => Promise<void>;
  /** Atualização otimista: muda a tela na hora, antes da resposta do servidor (o reload confirma depois). */
  patchSnap: (fn: (s: Snapshot) => Snapshot) => void;
  /**
   * Atualização com a resposta do servidor de uma operação que começou no cachorro `dogId`: só vale se o diário
   * aberto ainda é esse (trocou de cachorro enquanto esperava? a resposta não vai para a tela do outro).
   */
  patchDog: (dogId: string | null | undefined, fn: (s: Snapshot) => Snapshot) => void;
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
      if (!CONFIG_OK) throw new Error("configuração ausente"); // sem demonstração: mostra "indisponível"
      const r = realRepository();
      if (!alive) return;
      repoRef.current = r;
      setRepo(r);
      const n = ++seq.current;
      apply(await r.loadSnapshot(), n);
      loadedAt.current = Date.now();
      void syncDeviceOwner(); // avisos deste aparelho são da conta que está aqui agora
    })().catch(() => alive && setUnavailable(true));
    return () => {
      alive = false;
    };
  }, []);

  // Só a resposta do pedido MAIS RECENTE vale: uma resposta atrasada (de outro cachorro) não sobrescreve a tela.
  const seq = useRef(0);
  const apply = useCallback((s: Snapshot, n: number) => {
    if (n !== seq.current) return;
    setActiveDog(s.dog?.id ?? null);
    setSnap(s);
  }, []);
  const loadedAt = useRef(0);
  const reload = useCallback(async () => {
    if (!repoRef.current) return;
    const n = ++seq.current;
    apply(await repoRef.current.loadSnapshot(), n);
    loadedAt.current = Date.now();
  }, [apply]);

  // Voltou ao app depois de um tempo (outra pessoa pode ter postado): busca dados novos.
  useEffect(() => {
    const onBack = () => {
      if (document.visibilityState === "visible" && loadedAt.current && Date.now() - loadedAt.current > 60_000) void reload().catch(() => {});
    };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    return () => { document.removeEventListener("visibilitychange", onBack); window.removeEventListener("focus", onBack); };
  }, [reload]);

  // Arte do Estúdio em andamento: quando terminar, o diário atualiza em qualquer tela.
  // Erro passageiro (rede, servidor) tenta de novo; só sai da lista quando o pedido não existe mais
  // ou depois que o diário daquele cachorro foi recarregado com sucesso.
  // Uma volta por vez: a próxima só começa 5 s depois que a anterior terminou (sem acúmulo em internet lenta).
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loop = async () => {
      if (stopped) return;
      if (repoRef.current && document.visibilityState === "visible") await checkArts();
      if (!stopped) timer = setTimeout(loop, 5000);
    };
    const checkArts = async () => {
      for (const p of pendingArts()) {
        let done = false;
        let job: StudioJob | null = null;
        try {
          const j = await studioJob(p.id);
          job = j;
          done = j.state !== "queued" && j.state !== "processing";
          if (done && j.dogId && j.dogId !== getActiveDog()) { untrackArt(p.id); continue; } // outro cachorro: carrega ao abrir o diário dele
        } catch (e) {
          if (e instanceof DomainError && e.code === "NOT_FOUND") untrackArt(p.id);
          continue;
        }
        if (done) {
          // Arte com nome/mensagem: guarda a versão composta antes de atualizar o Diário (se falhar, tenta na próxima).
          if (job && needsComposite(job) && repoRef.current) {
            const r = repoRef.current;
            try { await saveComposite(job, () => r.getMediaBlob(job!.outputMediaId!, "display")); } catch { continue; }
          }
          try { await reload(); untrackArt(p.id); } catch { /* tenta de novo na próxima volta */ }
        }
      }
    };
    timer = setTimeout(loop, 5000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [reload]);

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
  const patchDog = useCallback((dogId: string | null | undefined, fn: (s: Snapshot) => Snapshot) => setSnap((s) => (s && dogId && s.dog?.id === dogId ? fn(s) : s)), []);
  const value = useMemo(() => ({ repo, snap, unavailable, reload, reset, patchSnap, patchDog }), [repo, snap, unavailable, reload, reset, patchSnap, patchDog]);
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
/** `enabled: false` = ainda não baixa (foto longe da tela); baixa quando passar a true. */
export function useMediaBlob(id: string | null | undefined, variant: "thumb" | "display", enabled = true): Blob | null | undefined {
  const { repo } = useStore();
  const [b, setB] = useState<Blob | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!enabled) return;
    if (!repo || !id) {
      setB(id ? undefined : null);
      return;
    }
    setB(undefined);
    repo.getMediaBlob(id, variant).then((r) => alive && setB(r), () => alive && setB(null));
    return () => {
      alive = false;
    };
  }, [repo, id, variant, enabled]);
  return b;
}

/** Contexto do ciclo de missões a partir do snapshot (§7). `region`: calendário de quem está usando (usePrefs). */
export function cycleContext(snap: Snapshot, region: Region): CycleContext | null {
  if (!snap.dog) return null;
  return {
    dogId: snap.dog.id, region, birthDate: snap.dog.birthDate, today: snap.today,
    plan: snap.dailyPlan, completions: snap.completions, advances: snap.collectionAdvances,
  };
}
