/**
 * Regressão (revisão 25/10/2026, A3 — App Store 5.1.1(v)): excluir a conta revoga o login na Apple; se a Apple não
 * responder, a revogação fica numa fila sem ligação com a conta e a rotina diária tenta de novo.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ tokens: new Map<string, string>(), queue: [] as any[] }));
vi.mock("server-only", () => ({}));
vi.mock("./supabase", () => ({
  adminClient: () => ({
    from: (table: string) => {
      const eq: Record<string, any> = {};
      let op = "read", patch: any;
      const q: any = {};
      for (const k of ["select", "maybeSingle", "lte", "order", "limit"]) q[k] = () => q;
      q.eq = (k: string, v: any) => { eq[k] = v; return q; };
      for (const k of ["upsert", "insert", "update", "delete"]) q[k] = (v?: any) => { op = k; patch = v; return q; };
      q.then = (ok: any, no: any) => {
        let data: any = null;
        if (table === "apple_signin_tokens") {
          if (op === "upsert") m.tokens.set(patch.user_id, patch.refresh_token_sealed);
          else data = m.tokens.has(eq.user_id) ? { refresh_token_sealed: m.tokens.get(eq.user_id) } : null;
        }
        if (table === "apple_revocations") {
          if (op === "insert") m.queue.push({ id: `q${m.queue.length}`, created_at: new Date().toISOString(), ...patch });
          else if (op === "delete") m.queue = m.queue.filter((r) => r.id !== eq.id);
          else if (op === "update") Object.assign(m.queue.find((r) => r.id === eq.id), patch);
          else data = m.queue;
        }
        return Promise.resolve({ data, error: null }).then(ok, no);
      };
      return q;
    },
  }),
}));
import { retryAppleRevocations, revokeAppleSignIn, saveAppleToken, seal, unseal } from "./apple-signin";

const ok = () => vi.fn(async () => new Response(null, { status: 200 }));
const down = () => vi.fn(async () => { throw new Error("rede"); });
beforeEach(() => {
  m.tokens.clear(); m.queue = [];
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "segredo-de-teste"); vi.stubEnv("APPLE_SERVICES_ID", "com.diariodepatas.web"); vi.stubEnv("APPLE_SECRET", "jwt");
});

describe("login com a Apple", () => {
  it("o token fica cifrado no banco (nunca em texto puro) e volta igual", async () => {
    await saveAppleToken("u", "r.apple-token");
    expect(m.tokens.get("u")).not.toContain("apple-token");
    expect(unseal(m.tokens.get("u")!)).toBe("r.apple-token");
    const box = seal("conteúdo").split(".");
    box[3] = Buffer.from(Buffer.from(box[3], "base64url").map((b) => b ^ 1)).toString("base64url");
    expect(() => unseal(box.join("."))).toThrow(); // adulterado: recusa
  });
  it("excluir: chama a revogação da Apple com o token de atualização (sem fila)", async () => {
    await saveAppleToken("u", "r.apple-token");
    const fetcher = ok();
    expect(await revokeAppleSignIn("u", fetcher as never)).toBe("revoked");
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://appleid.apple.com/auth/revoke");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("token")).toBe("r.apple-token");
    expect(body.get("token_type_hint")).toBe("refresh_token");
    expect(m.queue).toEqual([]);
  });
  it("conta sem token: nada a revogar, nada na fila", async () => {
    expect(await revokeAppleSignIn("u")).toBe("no-token");
    expect(m.queue).toEqual([]);
  });
  it("Apple fora do ar: a exclusão segue e a revogação vai para a fila, sem ligação com a conta", async () => {
    await saveAppleToken("u", "r.apple-token");
    expect(await revokeAppleSignIn("u", down() as never)).toBe("failed");
    expect(m.queue).toHaveLength(1);
    expect(m.queue[0]).not.toHaveProperty("user_id");
    expect(unseal(m.queue[0].refresh_token_sealed)).toBe("r.apple-token");
  });
  it("rotina: tenta de novo; falhou, adia; conseguiu, apaga o token da fila", async () => {
    await saveAppleToken("u", "r.apple-token");
    await revokeAppleSignIn("u", down() as never);
    m.queue[0].next_try_at = new Date(0).toISOString();
    expect(await retryAppleRevocations(down() as never)).toEqual({ revoked: 0, pending: 1, expired: 0 });
    expect(m.queue[0].attempts).toBe(2);
    expect(Date.parse(m.queue[0].next_try_at)).toBeGreaterThan(Date.now());
    const fetcher = ok();
    expect(await retryAppleRevocations(fetcher as never)).toEqual({ revoked: 1, pending: 0, expired: 0 });
    expect(m.queue).toEqual([]);
  });
  it("rotina: depois de 30 dias sem conseguir, desiste e apaga o token (não fica guardado para sempre)", async () => {
    m.queue.push({ id: "velha", refresh_token_sealed: seal("r"), attempts: 9, created_at: new Date(Date.now() - 31 * 86_400_000).toISOString() });
    expect(await retryAppleRevocations(down() as never)).toEqual({ revoked: 0, pending: 0, expired: 1 });
    expect(m.queue).toEqual([]);
  });
  it("sem configuração no servidor: também vai para a fila (ao configurar, a rotina conclui)", async () => {
    await saveAppleToken("u", "r");
    vi.stubEnv("APPLE_SECRET", "");
    expect(await revokeAppleSignIn("u")).toBe("not-configured");
    expect(m.queue).toHaveLength(1);
  });
});
