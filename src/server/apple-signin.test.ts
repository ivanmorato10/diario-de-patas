/** Regressão (revisão 25/10/2026, A3 — App Store 5.1.1(v)): excluir a conta revoga o login na Apple (quando há token). */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ row: null as any, upserts: [] as any[] }));
vi.mock("server-only", () => ({}));
vi.mock("./supabase", () => ({
  adminClient: () => ({
    from: () => {
      const q: any = {};
      for (const k of ["select", "eq", "maybeSingle"]) q[k] = () => q;
      q.upsert = (v: any) => { m.upserts.push(v); m.row = v; return q; };
      q.then = (ok: any, no: any) => Promise.resolve({ data: m.row, error: null }).then(ok, no);
      return q;
    },
  }),
}));
import { revokeAppleSignIn, saveAppleToken, seal, unseal } from "./apple-signin";

beforeEach(() => {
  m.row = null; m.upserts = [];
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "segredo-de-teste"); vi.stubEnv("APPLE_SERVICES_ID", "com.diariodepatas.web"); vi.stubEnv("APPLE_SECRET", "jwt");
});

describe("login com a Apple", () => {
  it("o token fica cifrado no banco (nunca em texto puro) e volta igual", async () => {
    await saveAppleToken("u", "r.apple-token");
    expect(m.upserts[0].refresh_token_sealed).not.toContain("apple-token");
    expect(unseal(m.upserts[0].refresh_token_sealed)).toBe("r.apple-token");
    const box = seal("conteúdo").split(".");
    box[3] = Buffer.from(Buffer.from(box[3], "base64url").map((b) => b ^ 1)).toString("base64url");
    expect(() => unseal(box.join("."))).toThrow(); // adulterado: recusa
  });
  it("excluir: chama a revogação da Apple com o token de atualização", async () => {
    await saveAppleToken("u", "r.apple-token");
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    expect(await revokeAppleSignIn("u", fetcher as never)).toBe("revoked");
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://appleid.apple.com/auth/revoke");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("token")).toBe("r.apple-token");
    expect(body.get("token_type_hint")).toBe("refresh_token");
    expect(body.get("client_id")).toBe("com.diariodepatas.web");
  });
  it("conta sem token guardado ou Apple fora do ar: devolve o resultado, nunca lança (a exclusão segue)", async () => {
    expect(await revokeAppleSignIn("u")).toBe("no-token");
    await saveAppleToken("u", "r");
    expect(await revokeAppleSignIn("u", (async () => { throw new Error("rede"); }) as never)).toBe("failed");
    vi.stubEnv("APPLE_SECRET", "");
    expect(await revokeAppleSignIn("u")).toBe("not-configured");
  });
});
