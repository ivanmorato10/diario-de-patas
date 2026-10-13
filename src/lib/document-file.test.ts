import { describe, expect, it } from "vitest";
import { processDocument, sniffDocument } from "./document-file";

const enc = (s: string) => new TextEncoder().encode(s);

describe("arquivos de documentos (MUDANCAS-V2 §5)", () => {
  it("reconhece PDF e imagens pelos bytes, não pelo nome", () => {
    expect(sniffDocument(enc("%PDF-1.7\n%âãÏÓ"))).toBe("application/pdf");
    expect(sniffDocument(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffDocument(enc("Isto é só um texto"))).toBeNull();
    expect(sniffDocument(enc("%PD"))).toBeNull();
  });
  it("guarda o PDF como está", async () => {
    const pdf = new Blob([enc("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF")], { type: "application/pdf" });
    const out = await processDocument(pdf);
    expect(out.mime).toBe("application/pdf");
    expect(out.thumb).toBeNull();
    expect(new TextDecoder().decode(await out.file.arrayBuffer())).toContain("%%EOF");
  });
  it("recusa um arquivo de texto renomeado para .pdf", async () => {
    const fake = new File([enc("não sou um PDF")], "carteira.pdf", { type: "application/pdf" });
    await expect(processDocument(fake)).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });
  it("recusa arquivos acima do limite", async () => {
    const big = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]);
    await expect(processDocument(big)).rejects.toMatchObject({ code: "TOO_LARGE" });
  });
});
