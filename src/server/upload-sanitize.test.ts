/**
 * Regressão (revisão de segurança 02/11/2026, S03): o servidor não confia no navegador para tirar os metadados.
 * Uma chamada direta podia mandar a foto original (com GPS no EXIF) e ela ficava pronta como veio — e podia
 * aparecer num link compartilhado. Agora a imagem é regravada sem metadados antes de ficar pronta, o tipo
 * declarado precisa ser o tipo real, e SVG/HTML/executável/arquivo corrompido continuam recusados e apagados.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const m = vi.hoisted(() => ({ row: null as any, files: new Map<string, Buffer>(), removed: [] as string[], failUpload: false }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));
function db() {
  return {
    storage: {
      from: () => ({
        download: async (k: string) => (m.files.has(k) ? { data: new Blob([new Uint8Array(m.files.get(k)!)]), error: null } : { data: null, error: { message: "nf" } }),
        upload: async (k: string, b: Buffer) => { if (m.failUpload) return { error: { message: "x" } }; m.files.set(k, Buffer.from(b)); return { error: null }; },
        remove: async (k: string[]) => { m.removed.push(...k); k.forEach((x) => m.files.delete(x)); return { error: null }; },
      }),
    },
    rpc: async () => ({ data: null, error: null }),
    from: (table: string) => {
      let op = "read", patch: any;
      const q: any = {};
      for (const k of ["select", "eq", "is", "in", "order", "limit", "single", "maybeSingle", "not"]) q[k] = () => q;
      for (const k of ["insert", "update", "delete", "upsert"]) q[k] = (v: any) => { op = k; patch = v; return q; };
      q.then = (ok: any, no: any) => {
        let data: any = null;
        if (table === "dog_members") data = [{ dog_id: "abu", role: "admin", created_at: "", dogs: { id: "abu", owner_id: "u", name: "Abu" } }];
        if (table === "profiles") data = { user_id: "u", timezone: "UTC" };
        if (table === "media_assets" || table === "documents") {
          if (op === "update") Object.assign(m.row, patch); else if (op === "delete") m.row = null; else data = m.row;
        }
        return Promise.resolve({ data, error: null }).then(ok, no);
      };
      return q;
    },
  };
}
vi.mock("./supabase", () => ({
  HttpError: class extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } },
  adminClient: () => db(),
}));
import { RPC } from "./rpc";

const ctx: any = { user: { id: "u" }, supa: db() };
const ID = "22222222-2222-4222-8222-222222222222";
// EXIF com GPS (latitude/longitude de verdade no bloco IFD do GPS).
const gpsJpeg = () => sharp({ create: { width: 80, height: 60, channels: 3, background: "#996633" } })
  .withExifMerge({ IFD0: { Make: "Celular", Copyright: "dono" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "23/1 33/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "46/1 38/1 0/1" } })
  .jpeg().toBuffer();

const media = (mime = "image/jpeg") => ({ id: ID, dog_id: "abu", status: "pending_upload", private_storage_key: "u/x.jpg", thumb_storage_key: "u/x-thumb.jpg", mime, kind: "photo" });
const confirm = (kind: "media" | "document" = "media") => RPC.confirmUpload(ctx, { kind, id: ID });

beforeEach(() => { m.files = new Map(); m.removed = []; m.failUpload = false; });

describe("envio de foto conferido no servidor", () => {
  it("foto com GPS fica pronta SEM metadados (original e miniatura)", async () => {
    const raw = await gpsJpeg();
    expect((await sharp(raw).metadata()).exif).toBeTruthy(); // o teste começa com GPS de verdade
    m.row = media(); m.files.set("u/x.jpg", raw); m.files.set("u/x-thumb.jpg", raw);
    await confirm();
    expect(m.row.status).toBe("ready");
    for (const k of ["u/x.jpg", "u/x-thumb.jpg"]) {
      const meta = await sharp(m.files.get(k)!).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.format).toBe("jpeg");
      expect(m.files.get(k)!.includes(Buffer.from("Celular"))).toBe(false);
    }
  });

  it("falha ao regravar a versão limpa: não fica pronta", async () => {
    const raw = await gpsJpeg();
    m.row = media(); m.files.set("u/x.jpg", raw); m.files.set("u/x-thumb.jpg", raw); m.failUpload = true;
    await expect(confirm()).rejects.toMatchObject({ status: 500 });
    expect(m.row.status).toBe("pending_upload");
  });

  it("foto sem metadados não é regravada (o fluxo normal do app continua igual)", async () => {
    const webp = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#123456" } }).webp().toBuffer();
    m.row = { ...media("image/webp"), private_storage_key: "u/x.webp", thumb_storage_key: "u/x-thumb.webp" };
    m.files.set("u/x.webp", webp); m.files.set("u/x-thumb.webp", webp);
    await confirm();
    expect(m.row.status).toBe("ready");
    expect(m.files.get("u/x.webp")!.equals(webp)).toBe(true);
  });

  it("tipo declarado diferente do real (PNG dizendo ser JPEG) é recusado e apagado", async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).png().toBuffer();
    m.row = media(); m.files.set("u/x.jpg", png); m.files.set("u/x-thumb.jpg", png);
    await expect(confirm()).rejects.toMatchObject({ status: 400 });
    expect(m.row).toBeNull();
    expect(m.removed).toContain("u/x.jpg");
  });

  it.each([
    ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="9" height="9"/></svg>')],
    ["HTML", Buffer.from("<!doctype html><script>alert(1)</script>")],
    ["executável", Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff", "latin1")],
    ["bytes corrompidos", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])],
  ])("%s com nome de foto é recusado e apagado", async (_n, bytes) => {
    m.row = media(); m.files.set("u/x.jpg", bytes); m.files.set("u/x-thumb.jpg", bytes);
    await expect(confirm()).rejects.toMatchObject({ status: 400 });
    expect(m.row).toBeNull();
  });

  it("acima de 10 MB de verdade é recusado (não vale o tamanho declarado)", async () => {
    const big = Buffer.concat([await gpsJpeg(), Buffer.alloc(10 * 1024 * 1024 + 1)]);
    m.row = media(); m.files.set("u/x.jpg", big); m.files.set("u/x-thumb.jpg", await gpsJpeg());
    await expect(confirm()).rejects.toMatchObject({ status: 400 });
  });

  it("imagem gigante em pixels (bomba de descompressão) é recusada", async () => {
    const huge = await sharp({ create: { width: 8000, height: 6000, channels: 3, background: "#fff" } }).png({ compressionLevel: 9 }).toBuffer();
    m.row = { ...media("image/png"), private_storage_key: "u/x.png", thumb_storage_key: "u/x-thumb.png" };
    m.files.set("u/x.png", huge); m.files.set("u/x-thumb.png", huge);
    await expect(confirm()).rejects.toMatchObject({ status: 400 });
  });

  it("documento em imagem com GPS também é limpo", async () => {
    const raw = await gpsJpeg();
    m.row = { id: ID, dog_id: "abu", status: "pending_upload", private_storage_key: "u/d.jpg", thumb_storage_key: null, mime: "image/jpeg" };
    m.files.set("u/d.jpg", raw);
    await confirm("document");
    expect(m.row.status).toBe("ready");
    expect((await sharp(m.files.get("u/d.jpg")!).metadata()).exif).toBeUndefined();
  });
});
