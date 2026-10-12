import { describe, expect, it } from "vitest";
import { exifDateToCivil, readPhotoDate } from "./exif";

/** TIFF little-endian: IFD0 → ponteiro para o Exif IFD → DateTimeOriginal. */
function tiffWithDate(date: string): Uint8Array {
  const str = new TextEncoder().encode(`${date}\0`); // 20 bytes
  const buf = new Uint8Array(8 + 18 + 18 + str.length);
  const dv = new DataView(buf.buffer);
  buf.set([0x49, 0x49]); // "II"
  dv.setUint16(2, 42, true);
  dv.setUint32(4, 8, true); // IFD0 em 8
  dv.setUint16(8, 1, true); // 1 entrada
  dv.setUint16(10, 0x8769, true); // ExifIFD
  dv.setUint16(12, 4, true); // LONG
  dv.setUint32(14, 1, true);
  dv.setUint32(18, 26, true); // Exif IFD em 26
  dv.setUint32(22, 0, true);
  dv.setUint16(26, 1, true);
  dv.setUint16(28, 0x9003, true); // DateTimeOriginal
  dv.setUint16(30, 2, true); // ASCII
  dv.setUint32(32, str.length, true);
  dv.setUint32(36, 44, true); // valor em 44
  dv.setUint32(40, 0, true);
  buf.set(str, 44);
  return buf;
}

const exifHeader = [0x45, 0x78, 0x69, 0x66, 0, 0];

function jpeg(tiff: Uint8Array): Uint8Array {
  const len = 2 + 6 + tiff.length;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 0xff, ...exifHeader, ...tiff, 0xff, 0xda, 0, 2, 0xff, 0xd9]);
}

function png(tiff: Uint8Array): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const len = tiff.length;
  const chunk = [len >>> 24, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff, ...new TextEncoder().encode("eXIf"), ...tiff, 0, 0, 0, 0];
  return new Uint8Array([...sig, ...chunk]);
}

function webp(tiff: Uint8Array): Uint8Array {
  const len = tiff.length;
  const chunk = [...new TextEncoder().encode("EXIF"), len & 0xff, (len >> 8) & 0xff, (len >> 16) & 0xff, len >>> 24, ...tiff, ...(len % 2 ? [0] : [])];
  return new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP"), ...chunk]);
}

describe("data da foto pelo EXIF (MUDANCAS-V2 §2)", () => {
  it("converte a data da câmera sem passar por fuso", () => {
    expect(exifDateToCivil("2025:12:31 23:59:59")).toBe("2025-12-31");
    expect(exifDateToCivil("0000:00:00 00:00:00")).toBeNull();
    expect(exifDateToCivil("2025:02:30 10:00:00")).toBeNull();
  });
  it("lê DateTimeOriginal em JPEG, PNG e WebP", () => {
    const t = tiffWithDate("2024:07:09 08:15:00");
    expect(readPhotoDate(jpeg(t), "image/jpeg")).toBe("2024-07-09");
    expect(readPhotoDate(png(t), "image/png")).toBe("2024-07-09");
    expect(readPhotoDate(webp(t), "image/webp")).toBe("2024-07-09");
  });
  it("sem EXIF ou com bytes quebrados devolve null", () => {
    expect(readPhotoDate(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]), "image/jpeg")).toBeNull();
    expect(readPhotoDate(jpeg(new Uint8Array([1, 2, 3])), "image/jpeg")).toBeNull();
  });
});
