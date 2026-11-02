/**
 * Regressão (revisão de segurança 02/11/2026, S04): pedido de envio só sai com cota. Sem cota, ou sem resposta do
 * banco, nenhum registro pendente e nenhuma URL assinada de envio é criada.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ quota: { data: true as unknown, error: null as unknown }, inserts: 0, signed: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));
function db() {
  return {
    storage: { from: () => ({ createSignedUploadUrl: async () => { m.signed++; return { data: { token: "t" }, error: null }; } }) },
    rpc: async (name: string) => (name === "take_upload_ticket" ? m.quota : { data: null, error: null }),
    from: (table: string) => {
      const q: any = {};
      for (const k of ["select", "eq", "is", "in", "order", "limit", "single", "maybeSingle"]) q[k] = () => q;
      q.insert = () => { m.inserts++; return q; };
      q.then = (ok: any, no: any) => Promise.resolve({
        data: table === "dog_members" ? [{ dog_id: "abu", role: "admin", created_at: "", dogs: { id: "abu", owner_id: "u", name: "Abu" } }] : null, error: null,
      }).then(ok, no);
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
const photo = { kind: "media", mime: "image/webp", sizes: { display: 1000, thumb: 100 }, width: 10, height: 10, hash: "h" };

beforeEach(() => { m.quota = { data: true, error: null }; m.inserts = 0; m.signed = 0; });

describe("pedido de envio com cota", () => {
  it("com cota: cria o registro e as URLs de envio", async () => {
    const r: any = await RPC.createUpload(ctx, photo);
    expect(r.uploads).toHaveLength(2);
    expect(m.inserts).toBe(1);
  });
  it("sem cota: 429 e nada é criado", async () => {
    m.quota = { data: false, error: null };
    await expect(RPC.createUpload(ctx, photo)).rejects.toMatchObject({ status: 429, code: "RATE_LIMIT" });
    expect(m.inserts + m.signed).toBe(0);
  });
  it("banco sem responder a cota: não emite (falha fechada)", async () => {
    m.quota = { data: null, error: { message: "function does not exist" } };
    await expect(RPC.createUpload(ctx, photo)).rejects.toMatchObject({ status: 503 });
    expect(m.inserts + m.signed).toBe(0);
  });
  it("documento também conta", async () => {
    m.quota = { data: false, error: null };
    await expect(RPC.createUpload(ctx, { kind: "document", mime: "application/pdf", sizes: { file: 100 }, title: "RG", category: "id_chip" })).rejects.toMatchObject({ status: 429 });
    expect(m.inserts).toBe(0);
  });
});
