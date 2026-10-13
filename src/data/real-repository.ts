/**
 * Modo real (MUDANCAS-V2 §8): a interface `Repository` sobre a API do próprio app.
 * O servidor é a autoridade de posse, XP, cotas e plano do dia; o navegador só processa as fotos
 * (EXIF, metadados, miniatura) e envia os arquivos direto ao bucket privado por URL assinada.
 */
import { DomainError } from "./demo-repository";
import type { Repository } from "./repository";

/** Chamada a uma operação do servidor. Erros de regra viram DomainError (mesma mensagem do modo demo). */
export async function rpc<T>(method: string, args: unknown = {}): Promise<T> {
  const res = await fetch(`/api/rpc/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
    credentials: "same-origin",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") window.location.assign("/entrar");
    throw new DomainError(body?.code ?? "SERVER", body?.message ?? "Não conseguimos falar com o servidor. Tente de novo.");
  }
  return body as T;
}

/** Envia um arquivo para a URL assinada de upload que o servidor criou. */
async function putSigned(url: string, file: Blob) {
  const res = await fetch(url, { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false" } });
  if (!res.ok) throw new DomainError("UPLOAD", "Não conseguimos enviar o arquivo. Tente de novo.");
}

interface UploadTicket {
  id: string;
  uploads: { variant: "display" | "thumb" | "file"; url: string }[];
}

/** Cria o registro, envia as variantes e pede ao servidor para inspecionar os bytes antes de aceitar. */
async function upload(kind: "media" | "document", meta: Record<string, unknown>, files: Partial<Record<"display" | "thumb" | "file", Blob | null>>): Promise<string> {
  const ticket = await rpc<UploadTicket>("createUpload", { kind, ...meta, sizes: Object.fromEntries(Object.entries(files).map(([k, b]) => [k, b?.size ?? 0])) });
  for (const u of ticket.uploads) {
    const b = files[u.variant];
    if (b) await putSigned(u.url, b);
  }
  await rpc("confirmUpload", { kind, id: ticket.id });
  return ticket.id;
}

const blobCache = new Map<string, Promise<Blob | null>>();

export function realRepository(): Repository {
  const mediaUpload = (img: { mime: string; width: number; height: number; bytes: number; hash: string; display: Blob; thumb: Blob }, kind: "photo" | "art" = "photo") =>
    upload("media", { mime: img.mime, width: img.width, height: img.height, hash: img.hash, mediaKind: kind }, { display: img.display, thumb: img.thumb });

  return {
    mode: "real",
    loadSnapshot: () => rpc("snapshot"),
    getMediaBlob(id, variant) {
      const key = `${id}:${variant}`;
      if (!blobCache.has(key)) {
        blobCache.set(key, fetch(`/api/media/${id}?v=${variant}`, { credentials: "same-origin" }).then((r) => (r.ok ? r.blob() : null)).catch(() => null));
      }
      return blobCache.get(key)!;
    },
    async createDiary(input) {
      const photoMediaId = input.photo ? await rpc<{ id: string }>("ensureProfile", { timezone: input.timezone }).then(() => mediaUpload(input.photo!)) : null;
      return rpc("createDiary", { ...input, photo: undefined, photoMediaId });
    },
    async updateDog(patch) {
      const photoMediaId = patch.photo === undefined ? undefined : patch.photo === null ? null : await mediaUpload(patch.photo);
      return rpc("updateDog", { ...patch, photo: undefined, photoMediaId });
    },
    updateTimezone: (timezone) => rpc("updateTimezone", { timezone }),
    findEntryByHash: (hash) => rpc("findEntryByHash", { hash }),
    async saveEntry(input) {
      // Retry com a mesma chave não reenvia a foto: o servidor devolve a lembrança existente.
      const existing = await rpc<{ entry: unknown } | null>("entryByRequestKey", { requestKey: input.requestKey });
      if (existing?.entry) return existing.entry as never;
      const mediaId = await mediaUpload(input.image, input.kind ?? "photo");
      return rpc("saveEntry", { ...input, image: undefined, mediaId });
    },
    updateEntry: (id, patch) => rpc("updateEntry", { id, ...patch }),
    deleteEntry: (id) => rpc("deleteEntry", { id }),
    submitMission: (input) => rpc("submitMission", input),
    swapDaily: (slot) => rpc("swapDaily", { slot }),
    saveHealthProfile: (input) => rpc("saveHealthProfile", input),
    addWeight: (input) => rpc("addWeight", input),
    saveVaccine: (input, id) => rpc("saveCare", { store: "vaccines", input, id }),
    saveVisit: (input, id) => rpc("saveCare", { store: "visits", input, id }),
    saveMedication: (input, id) => rpc("saveCare", { store: "medications", input, id }),
    saveContact: (input, id) => rpc("saveCare", { store: "contacts", input, id }),
    deleteHealthRecord: (store, id) => rpc("deleteCare", { store, id }),
    async addDocument(meta, file) {
      const id = await upload("document", { ...meta, mime: file.mime }, { file: file.file, thumb: file.thumb });
      return rpc("getDocument", { id });
    },
    updateDocument: (id, meta) => rpc("updateDocument", { id, meta }),
    deleteDocument: (id) => rpc("deleteDocument", { id }),
    async getDocumentFile(id) {
      const [file, thumb] = await Promise.all(["file", "thumb"].map((v) => fetch(`/api/documents/${id}?v=${v}`, { credentials: "same-origin" }).then((r) => (r.ok ? r.blob() : null))));
      return file ? { file, thumb } : null;
    },
    exportMetadata: () => rpc("exportMetadata"),
    async wipe() {
      await rpc("deleteAccount");
      blobCache.clear();
    },
  };
}
