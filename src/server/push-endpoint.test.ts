/**
 * Regressão (revisão de segurança 02/11/2026, S01): endereço de push só de serviço conhecido. Antes, qualquer URL
 * era aceita e o servidor fazia POST nela ao avisar (SSRF): localhost, rede interna ou servidor de quem cadastrou.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ subs: [] as any[], upserts: [] as any[], deletes: 0, sent: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("web-push", () => ({ default: { setVapidDetails: () => {}, sendNotification: async (s: any) => { m.sent.push(s.endpoint); } } }));
vi.mock("./i18n", () => ({ localesOf: async () => new Map(), requestLocale: async () => "pt-BR", translator: () => (k: string) => k }));
vi.mock("./supabase", () => ({
  HttpError: class extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } },
  adminClient: () => ({
    from: () => {
      const q: any = {};
      let op = "read";
      for (const k of ["select", "eq", "in", "is", "maybeSingle"]) q[k] = () => q;
      q.upsert = (v: any) => { m.upserts.push(v); op = "write"; return q; };
      q.delete = () => { m.deletes++; op = "write"; return q; };
      q.then = (ok: any, no: any) => Promise.resolve({ data: op === "read" ? m.subs : null, error: null }).then(ok, no);
      return q;
    },
  }),
}));
import { isPushEndpoint, savePushSubscription, testPush } from "./notify";

const ctx: any = { user: { id: "u" } };
const keys = { p256dh: "BPk", auth: "a" };

beforeEach(() => {
  m.subs = []; m.upserts = []; m.deletes = 0; m.sent = [];
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub"; process.env.VAPID_PRIVATE_KEY = "priv";
});

describe("endereço de push", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QH-abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("aceita serviço conhecido: %s", (url) => expect(isPushEndpoint(url)).toBe(true));

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc", // sem HTTPS
    "https://localhost/x", "https://127.0.0.1/x", "https://169.254.169.254/latest/meta-data", "https://[::1]/x",
    "https://10.0.0.5/x", "https://atacante.example/x",
    "https://fcm.googleapis.com.atacante.example/x", // disfarce no fim
    "https://fcm.googleapis.com:8443/x", // outra porta
    "https://user:pw@fcm.googleapis.com/x", // credenciais na URL
    "https://evilpush.apple.com.example/x", "https://notpush.apple.com/x", "javascript:alert(1)", "não é url",
  ])("recusa: %s", (url) => expect(isPushEndpoint(url)).toBe(false));

  it("cadastro com endereço fora da lista é recusado antes de gravar", async () => {
    await expect(savePushSubscription(ctx, { subscription: { endpoint: "https://127.0.0.1:3000/admin", keys } })).rejects.toMatchObject({ status: 400 });
    expect(m.upserts).toHaveLength(0);
  });

  it("cadastro válido é gravado", async () => {
    await savePushSubscription(ctx, { subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys } });
    expect(m.upserts).toHaveLength(1);
  });

  it("cadastro antigo fora da lista não recebe POST e é removido", async () => {
    m.subs = [
      { id: "1", kind: "web", endpoint: "http://169.254.169.254/latest", p256dh: "k", auth: "a" },
      { id: "2", kind: "web", endpoint: "https://fcm.googleapis.com/fcm/send/ok", p256dh: "k", auth: "a" },
    ];
    const r = await testPush(ctx);
    expect(m.sent).toEqual(["https://fcm.googleapis.com/fcm/send/ok"]);
    expect(m.deletes).toBe(1);
    expect(r).toMatchObject({ accepted: 1 });
  });
});
