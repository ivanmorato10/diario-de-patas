import { afterEach, describe, expect, it, vi } from "vitest";

/** Sem a configuração do Supabase o app NÃO entra em modo demonstração: responde "indisponível" e registra o erro. */
describe("configuração ausente", () => {
  const saved = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.key;
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("responde 503 'indisponível' e registra o erro uma vez", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
    vi.resetModules();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { configMissing } = await import("./config-check");
    const { CONFIG_OK } = await import("@/config/mode");
    expect(CONFIG_OK).toBe(false);
    const res = configMissing();
    expect(res?.status).toBe(503);
    expect(await res!.json()).toEqual({ code: "UNAVAILABLE", message: "O app está temporariamente indisponível. Tente de novo em alguns minutos." });
    expect((await configMissing("en")!.json()).message).toBe("The app is temporarily unavailable. Please try again in a few minutes.");
    configMissing();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("com configuração, segue normal", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-publica";
    vi.resetModules();
    const { configMissing } = await import("./config-check");
    expect(configMissing()).toBeNull();
  });
});
