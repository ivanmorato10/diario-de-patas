/**
 * Regressão (desempenho, 25/10/2026): trocar de cachorro grava a escolha e carrega o diário novo AO MESMO TEMPO.
 * Se a gravação falhar, volta para o cachorro anterior (nenhuma operação seguinte vai para o diário errado).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ active: "abu" as string | null, switchFails: false, order: [] as string[] }));
vi.mock("./real-repository", () => ({
  setActiveDog: (d: string | null) => { m.active = d; },
  rpc: async (method: string) => {
    m.order.push(`${method}:start`);
    await new Promise((r) => setTimeout(r, 20));
    m.order.push(`${method}:end`);
    if (m.switchFails) throw new Error("rede");
    return {};
  },
}));
import { switchDogAndLoad } from "./family-client";
import { noteUnreadFresh, unreadIsFresh, UNREAD_FRESH_MS } from "@/lib/unread";

afterEach(() => { m.active = "abu"; m.switchFails = false; m.order = []; });

describe("trocar de cachorro", () => {
  it("grava e carrega ao mesmo tempo, já com o cachorro novo", async () => {
    const loads: (string | null)[] = [];
    const reload = async () => { loads.push(m.active); m.order.push("reload:start"); await new Promise((r) => setTimeout(r, 20)); m.order.push("reload:end"); };
    await switchDogAndLoad("pepe", "abu", reload);
    expect(loads).toEqual(["pepe"]);
    expect(m.order.slice(0, 2).sort()).toEqual(["reload:start", "switchDog:start"]); // as duas começam antes de qualquer uma terminar
    expect(m.active).toBe("pepe");
  });
  it("gravação falhou: volta para o anterior e recarrega nele", async () => {
    m.switchFails = true;
    const loads: (string | null)[] = [];
    await expect(switchDogAndLoad("pepe", "abu", async () => { loads.push(m.active); })).rejects.toThrow("rede");
    expect(m.active).toBe("abu");
    expect(loads).toEqual(["pepe", "abu"]);
  });
  it("gravou, mas a carga falhou: avisa que trocou (a tela abre do zero no cachorro novo)", async () => {
    await expect(switchDogAndLoad("pepe", "abu", async () => { throw new Error("x"); })).rejects.toMatchObject({ switched: true });
    expect(m.active).toBe("pepe");
  });
});

describe("contagem de novidades", () => {
  it("não busca de novo logo depois do snapshot (que já traz a contagem)", () => {
    noteUnreadFresh(1_000_000);
    expect(unreadIsFresh(1_000_000 + 5_000)).toBe(true);
    expect(unreadIsFresh(1_000_000 + UNREAD_FRESH_MS + 1)).toBe(false);
  });
});
