/**
 * Arquivos de documentos (MUDANCAS-V2 §5): PDF, JPEG, PNG ou WebP até 10 MB, validados pelos bytes.
 * - PDF: precisa começar com “%PDF-”; é guardado como está.
 * - Imagem: mesmo processamento das fotos (EXIF corrigido, metadados removidos, miniatura).
 * Um arquivo de texto renomeado para .pdf é recusado.
 */
import { LIMITS } from "@/config/business";
import type { DocumentMime } from "@/domain/documents";
import { ImageError, processImage, sniffMime } from "./image";

/** `message` é uma chave dos arquivos de idioma (a tela traduz). */
export class DocumentFileError extends Error {
  constructor(readonly code: "TOO_LARGE" | "UNSUPPORTED", message: string) {
    super(message);
  }
}

export const DOCUMENT_DISPLAY_MAX_EDGE = 2400;

export function sniffDocument(head: Uint8Array): DocumentMime | null {
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d) return "application/pdf"; // %PDF-
  const img = sniffMime(head);
  return img === "image/jpeg" || img === "image/png" || img === "image/webp" ? img : null;
}

export interface ProcessedDocument {
  mime: DocumentMime;
  bytes: number;
  file: Blob;
  thumb: Blob | null;
}

export async function processDocument(file: Blob): Promise<ProcessedDocument> {
  if (file.size > LIMITS.maxUploadBytes) {
    throw new DocumentFileError("TOO_LARGE", `errors.docTooLarge?mb=${Math.round(LIMITS.maxUploadBytes / 1024 / 1024)}`);
  }
  const buf = await file.arrayBuffer();
  const mime = sniffDocument(new Uint8Array(buf, 0, Math.min(32, buf.byteLength)));
  if (!mime) {
    throw new DocumentFileError("UNSUPPORTED", "errors.notPdfOrImage");
  }
  if (mime === "application/pdf") return { mime, bytes: buf.byteLength, file: new Blob([buf], { type: mime }), thumb: null };
  try {
    const img = await processImage(new Blob([buf], { type: mime }), { displayMaxEdge: DOCUMENT_DISPLAY_MAX_EDGE });
    return { mime: img.mime as DocumentMime, bytes: img.bytes, file: img.display, thumb: img.thumb };
  } catch (e) {
    if (e instanceof ImageError) throw new DocumentFileError("UNSUPPORTED", e.message);
    throw e;
  }
}
