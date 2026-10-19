/**
 * Modo real (MUDANCAS-V2 §8): a interface `Repository` sobre a API do próprio app.
 * O servidor é a autoridade de posse, XP, cotas e plano do dia; o navegador só processa as fotos
 * (EXIF, metadados, miniatura) e envia os arquivos direto ao bucket privado por URL assinada.
 */
import { DomainError } from "./demo-repository";
import { browserClient } from "./supabase-browser";
import { isPublicPath } from "@/config/routes";
import type { Repository, Snapshot } from "./repository";
import { EMPTY_HEALTH } from "@/domain/health";

/** Chamada a uma operação do servidor. Erros de regra viram DomainError (mesma mensagem do modo demo). */
/**
 * Cachorro que ESTA tela mostra. Vai em toda chamada (x-ddp-dog): com a mesma conta em dois aparelhos,
 * cada um mexe no seu cachorro, e não no "aberto por último" salvo na conta. O servidor confere o acesso.
 */
let activeDog: string | null = null;
export const setActiveDog = (id: string | null | undefined) => { activeDog = id ?? null; };
export const getActiveDog = () => activeDog;

export async function rpc<T>(method: string, args: unknown = {}): Promise<T> {
  const res = await fetch(`/api/rpc/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(activeDog ? { "x-ddp-dog": activeDog } : {}) },
    body: JSON.stringify(args),
    credentials: "same-origin",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // Sem sessão: quem leva para /entrar é o proxy (nas páginas protegidas); aqui só sinaliza.
    throw new DomainError(body?.code ?? "SERVER", body?.message ?? "errors.serverUnreachable");
  }
  return body as T;
}

interface UploadTicket {
  id: string;
  bucket: "media" | "documents";
  uploads: { variant: "display" | "thumb" | "file"; path: string; token: string }[];
}

/** Cria o registro, envia as variantes e pede ao servidor para inspecionar os bytes antes de aceitar. */
async function upload(kind: "media" | "document", meta: Record<string, unknown>, files: Partial<Record<"display" | "thumb" | "file", Blob | null>>): Promise<string> {
  const ticket = await rpc<UploadTicket>("createUpload", { kind, ...meta, sizes: Object.fromEntries(Object.entries(files).map(([k, b]) => [k, b?.size ?? 0])) });
  for (const u of ticket.uploads) {
    const b = files[u.variant];
    if (!b) continue;
    // Direto para o bucket privado, com o token de uso único que o servidor gerou.
    const { error } = await browserClient().storage.from(ticket.bucket).uploadToSignedUrl(u.path, u.token, b, { contentType: b.type || "application/octet-stream" });
    if (error) throw new DomainError("UPLOAD", "errors.uploadFailed");
  }
  await rpc("confirmUpload", { kind, id: ticket.id });
  return ticket.id;
}

const blobCache = new Map<string, Promise<Blob | null>>();

function emptySnapshot(): Snapshot {
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return { profile: null, dog: null, entries: [], albumEntries: [], completions: [], xpTotal: 0, xpMonth: 0, today, health: EMPTY_HEALTH, dailyPlan: null, collectionAdvances: [], medals: [], customAlbums: [] };
}

export function realRepository(): Repository {
  const mediaUpload = (img: { mime: string; width: number; height: number; bytes: number; hash: string; display: Blob; thumb: Blob }, kind: "photo" | "art" = "photo") =>
    upload("media", { mime: img.mime, width: img.width, height: img.height, hash: img.hash, mediaKind: kind }, { display: img.display, thumb: img.thumb });

  return {
    mode: "real",
    async loadSnapshot() {
      try {
        return await rpc("snapshot");
      } catch (e) {
        // O cachorro desta tela não está mais acessível (removido, apagado): carrega o diário que restou.
        if (e instanceof DomainError && e.code === "DIARY_GONE") {
          setActiveDog(null);
          return await rpc("snapshot");
        }
        // Páginas abertas (boas-vindas, entrar, sobre) funcionam sem conta: diário vazio.
        if (e instanceof DomainError && e.code === "UNAUTHENTICATED") {
          // Sessão que o servidor não aceita mais (ex.: conta excluída, token revogado): limpa e pede login.
          await browserClient().auth.signOut({ scope: "local" }).catch(() => undefined);
          const path = window.location.pathname;
          if (!isPublicPath(path)) window.location.assign(`/entrar?next=${encodeURIComponent(path)}`);
          return emptySnapshot();
        }
        throw e;
      }
    },
    getMediaBlob(id, variant) {
      const key = `${id}:${variant}`;
      if (!blobCache.has(key)) {
        // Só o sucesso fica guardado. Falha de rede/servidor sai do cache (a próxima tela tenta de novo);
        // "não existe/sem acesso" fica guardado por 1 min, para não insistir em loop.
        const forget = () => blobCache.delete(key);
        blobCache.set(key, fetch(`/api/media/${id}?v=${variant}`, { credentials: "same-origin" })
          .then((r) => {
            if (r.ok) return r.blob();
            if (r.status === 404 || r.status === 403) setTimeout(forget, 60_000);
            else forget();
            return null;
          })
          .catch(() => { forget(); return null; }));
      }
      return blobCache.get(key)!;
    },
    async createDiary(input) {
      // A foto pertence ao cachorro: cria o diário primeiro e envia a foto em seguida.
      const dog = await rpc<Awaited<ReturnType<Repository["createDiary"]>>>("createDiary", { ...input, photo: undefined });
      setActiveDog(dog.id); // o cachorro novo passa a ser o desta tela
      if (!input.photo) return dog;
      return rpc("updateDog", { photoMediaId: await mediaUpload(input.photo) });
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
    createAlbum: (title) => rpc("createAlbum", { title }),
    renameAlbum: (id, title) => rpc("renameAlbum", { id, title }),
    deleteAlbum: (id) => rpc("deleteAlbum", { id }),
    addEntriesToAlbum: (albumId, entryIds) => rpc("addEntriesToAlbum", { albumId, entryIds }),
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
    createShare: (title, entryIds) => rpc("createShare", { title, entryIds }),
    listShares: () => rpc("listShares"),
    revokeShare: (id) => rpc("revokeShare", { id }),
    markDemoImported: () => rpc("markDemoImported"),
    exportMetadata: () => rpc("exportMetadata"),
    async wipe() {
      await rpc("deleteAccount");
      blobCache.clear();
    },
  };
}
