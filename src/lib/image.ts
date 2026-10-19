/**
 * Processamento de fotos no navegador (§18):
 * - valida o tipo pelos bytes (assinatura), não pela extensão;
 * - limita bytes e pixels;
 * - corrige a orientação EXIF e re-codifica, o que remove metadados (inclusive GPS);
 * - gera variante de exibição e miniatura; o hash é do arquivo original.
 * Em produção o servidor repete a inspeção dos bytes (Etapa C) — o cliente não é autoridade.
 */
import { IMAGE, LIMITS } from "@/config/business";
import type { ProcessedImage } from "@/data/demo-repository";
import { readPhotoDate } from "./exif";

/** `message` é uma chave dos arquivos de idioma (a tela traduz). */
export class ImageError extends Error {
  constructor(readonly code: "TOO_LARGE" | "UNSUPPORTED" | "HEIC" | "CORRUPT" | "TOO_MANY_PIXELS", message: string) {
    super(message);
  }
}

export function sniffMime(head: Uint8Array): string | null {
  const s = (i: number, str: string) => [...str].every((c, k) => head[i + k] === c.charCodeAt(0));
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head[0] === 0x89 && s(1, "PNG")) return "image/png";
  if (s(0, "RIFF") && s(8, "WEBP")) return "image/webp";
  if (s(4, "ftyp") && (s(8, "heic") || s(8, "heix") || s(8, "mif1") || s(8, "msf1") || s(8, "hevc"))) return "image/heic";
  return null;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fit(w: number, h: number, max: number) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

function supportsWebpEncode(): boolean {
  try {
    return document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

async function encode(bmp: ImageBitmap, maxEdge: number, quality: number, mime: string): Promise<Blob> {
  const { w, h } = fit(bmp.width, bmp.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("CORRUPT", "errors.imagePrepare");
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, quality));
  if (!blob) throw new ImageError("CORRUPT", "errors.imagePrepare");
  return blob;
}

/** Lê largura/altura sem decodificar a imagem inteira (JPEG/PNG/WebP), para o limite de pixels. */
function readDimensions(buf: Uint8Array, mime: string): { w: number; h: number } | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  try {
    if (mime === "image/png") return { w: dv.getUint32(16), h: dv.getUint32(20) };
    if (mime === "image/webp") {
      const chunk = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
      if (chunk === "VP8X") return { w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)) };
      if (chunk === "VP8 ") return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
      if (chunk === "VP8L") {
        const b = dv.getUint32(21, true);
        return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
      }
    }
    if (mime === "image/jpeg") {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        const len = dv.getUint16(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) };
        }
        i += 2 + len;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** `displayMaxEdge` maior serve para documentos, onde o texto precisa continuar legível. */
export async function processImage(file: Blob, opts: { displayMaxEdge?: number } = {}): Promise<ProcessedImage> {
  const maxEdge = opts.displayMaxEdge ?? IMAGE.displayMaxEdge;
  if (file.size > LIMITS.maxUploadBytes) {
    throw new ImageError("TOO_LARGE", `errors.imageTooLarge?mb=${Math.round(LIMITS.maxUploadBytes / 1024 / 1024)}`);
  }
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const mime = sniffMime(bytes.subarray(0, 32));
  if (mime === "image/heic") {
    throw new ImageError("HEIC", "errors.imageHeic");
  }
  if (!mime || !(IMAGE.acceptedMime as readonly string[]).includes(mime)) {
    throw new ImageError("UNSUPPORTED", "errors.notAPhoto");
  }
  const takenDate = readPhotoDate(bytes, mime); // lido antes de re-codificar (que remove o EXIF)
  const dims = readDimensions(bytes, mime);
  if (dims && dims.w * dims.h > LIMITS.maxUploadPixels) {
    throw new ImageError("TOO_MANY_PIXELS", "errors.imageTooManyPixels");
  }
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(new Blob([buf], { type: mime }), { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("CORRUPT", "errors.imageCorrupt");
  }
  const out = supportsWebpEncode() ? "image/webp" : "image/jpeg";
  try {
    const display = await encode(bmp, maxEdge, IMAGE.displayQuality, out);
    const thumb = await encode(bmp, IMAGE.thumbMaxEdge, IMAGE.thumbQuality, out);
    const { w, h } = fit(bmp.width, bmp.height, maxEdge);
    return { mime: out, width: w, height: h, bytes: display.size, hash: await sha256Hex(buf), display, thumb, takenDate };
  } finally {
    bmp.close();
  }
}

/** Gira 90° no sentido horário uma imagem já processada (ajuste manual de orientação, §8.5). */
export async function rotateProcessed(img: ProcessedImage): Promise<ProcessedImage> {
  const rot = async (b: Blob, q: number) => {
    const bmp = await createImageBitmap(b);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.height;
    canvas.height = bmp.width;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, img.mime, q));
    if (!out) throw new ImageError("CORRUPT", "errors.imageRotate");
    return out;
  };
  return {
    ...img,
    width: img.height,
    height: img.width,
    display: await rot(img.display, IMAGE.displayQuality),
    thumb: await rot(img.thumb, IMAGE.thumbQuality),
  };
}
