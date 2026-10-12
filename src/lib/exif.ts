/**
 * Lê a data em que a foto foi tirada (EXIF DateTimeOriginal), ANTES da re-codificação que remove
 * os metadados (MUDANCAS-V2 §2). Só a data civil é usada; nada mais do EXIF é guardado.
 * Suporta o bloco EXIF de JPEG (APP1), PNG (eXIf) e WebP (EXIF). Sem data → null.
 */
import { isCivilDate } from "@/domain/dates";
import type { CivilDate } from "@/domain/types";

const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;
const TAG_DATETIME = 0x0132;

/** "AAAA:MM:DD HH:MM:SS" (hora local da câmera) → "AAAA-MM-DD", sem passar por fuso. */
export function exifDateToCivil(v: string): CivilDate | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(v.trim());
  if (!m) return null;
  const d = `${m[1]}-${m[2]}-${m[3]}`;
  return isCivilDate(d) && m[1] !== "0000" ? d : null;
}

/** Procura as datas num bloco TIFF (o conteúdo do EXIF). */
export function readTiffDate(tiff: Uint8Array): CivilDate | null {
  if (tiff.length < 8) return null;
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const order = String.fromCharCode(tiff[0], tiff[1]);
  if (order !== "II" && order !== "MM") return null;
  const le = order === "II";
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);

  const readIfd = (offset: number): Map<number, { type: number; count: number; valueOffset: number }> => {
    const tags = new Map<number, { type: number; count: number; valueOffset: number }>();
    if (offset + 2 > tiff.length) return tags;
    const n = u16(offset);
    for (let i = 0; i < n; i++) {
      const e = offset + 2 + i * 12;
      if (e + 12 > tiff.length) break;
      tags.set(u16(e), { type: u16(e + 2), count: u32(e + 4), valueOffset: e + 8 });
    }
    return tags;
  };
  const ascii = (t: { type: number; count: number; valueOffset: number } | undefined): string | null => {
    if (!t || t.type !== 2 || t.count < 10) return null;
    const start = t.count > 4 ? u32(t.valueOffset) : t.valueOffset;
    if (start + t.count > tiff.length) return null;
    return String.fromCharCode(...tiff.subarray(start, start + Math.min(t.count, 20))).replace(/\0.*$/, "");
  };

  try {
    const ifd0 = readIfd(u32(4));
    const exifPtr = ifd0.get(TAG_EXIF_IFD);
    const exif = exifPtr ? readIfd(u32(exifPtr.valueOffset)) : new Map();
    for (const raw of [ascii(exif.get(TAG_DATETIME_ORIGINAL)), ascii(exif.get(TAG_DATETIME_DIGITIZED)), ascii(ifd0.get(TAG_DATETIME))]) {
      const d = raw ? exifDateToCivil(raw) : null;
      if (d) return d;
    }
  } catch {
    return null;
  }
  return null;
}

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"
const startsWith = (b: Uint8Array, at: number, sig: number[]) => sig.every((c, i) => b[at + i] === c);
const fourcc = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const stripExifHeader = (b: Uint8Array) => (startsWith(b, 0, EXIF_HEADER) ? b.subarray(6) : b);

/** Data em que a foto foi tirada, se o arquivo trouxer. */
export function readPhotoDate(bytes: Uint8Array, mime: string): CivilDate | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (mime === "image/jpeg") {
      let i = 2;
      while (i + 4 < bytes.length && bytes[i] === 0xff) {
        const marker = bytes[i + 1];
        if (marker === 0xda || marker === 0xd9) break; // início da imagem: não há mais metadados
        const len = dv.getUint16(i + 2);
        if (marker === 0xe1 && startsWith(bytes, i + 4, EXIF_HEADER)) return readTiffDate(bytes.subarray(i + 10, i + 2 + len));
        i += 2 + len;
      }
    } else if (mime === "image/png") {
      let i = 8;
      while (i + 12 <= bytes.length) {
        const len = dv.getUint32(i);
        const type = fourcc(bytes, i + 4);
        if (type === "eXIf") return readTiffDate(stripExifHeader(bytes.subarray(i + 8, i + 8 + len)));
        if (type === "IDAT" || type === "IEND") break;
        i += 12 + len;
      }
    } else if (mime === "image/webp") {
      let i = 12;
      while (i + 8 <= bytes.length) {
        const len = dv.getUint32(i + 4, true);
        if (fourcc(bytes, i) === "EXIF") return readTiffDate(stripExifHeader(bytes.subarray(i + 8, i + 8 + len)));
        i += 8 + len + (len % 2);
      }
    }
  } catch {
    return null;
  }
  return null;
}
