/**
 * Arte do Estúdio com nome/mensagem/moldura (desenhados pelo app): a versão composta é guardada como imagem da
 * lembrança, para o Diário, o álbum, o link público e o download mostrarem o mesmo que a tela de resultado.
 * Roda na tela de resultado e também no acompanhamento geral (a pessoa pode sair da tela). Uma vez por arte.
 */
import { presetById } from "@/config/studio";
import { rpc, uploadMediaFor } from "@/data/real-repository";
import type { StudioJob } from "@/data/studio-client";
import { composeArt } from "./compose-art";
import { processImage } from "./image";

export type ComposeMode = "card" | "banner" | "none";

export function composeModeFor(presetId: string): ComposeMode {
  const preset = presetById(presetId);
  return preset?.post === "card" ? "card" : preset?.addTextOverlay ? "banner" : "none";
}

/** Precisa guardar a composta? (tem texto para desenhar e ainda não foi guardada) */
export function needsComposite(job: StudioJob): boolean {
  return job.state === "succeeded" && !!job.outputMediaId && !job.compositeMediaId && composeModeFor(job.presetId) !== "none"
    && !!(job.overlay?.name?.trim() || job.overlay?.message?.trim());
}

const inFlight = new Map<string, Promise<void>>();

/** Guarda a composta (se precisar). `composed`: a que a tela de resultado já desenhou (evita desenhar de novo). */
export function saveComposite(job: StudioJob, getArt: () => Promise<Blob | null>, composed?: Blob | null): Promise<void> {
  if (!needsComposite(job)) return Promise.resolve();
  const cur = inFlight.get(job.id);
  if (cur) return cur;
  const run = (async () => {
    const art = composed ?? (await (async () => { const a = await getArt(); return a ? composeArt(a, job.overlay, composeModeFor(job.presetId)) : null; })());
    if (!art) return;
    const img = await processImage(art, { displayMaxEdge: 2048 });
    const mediaId = await uploadMediaFor(img, "art", job.dogId ?? null);
    await rpc("studioSetComposite", { jobId: job.id, mediaId }, { dog: job.dogId ?? null });
  })().finally(() => inFlight.delete(job.id));
  inFlight.set(job.id, run);
  return run;
}
