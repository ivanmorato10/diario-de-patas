/**
 * Regressão (auditoria 23/10/2026, item 1): uma operação de várias etapas fica no cachorro em que começou.
 * A 1ª resposta atrasa, a tela troca de Abu para Pepe no meio, e nenhuma etapa pode mudar de diário.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase-browser", () => ({ browserClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: async () => ({ error: null }) }) } }) }));
import { realRepository, setActiveDog } from "./real-repository";

const img = { mime: "image/jpeg", width: 1, height: 1, bytes: 1, hash: "hash", display: new Blob(["x"]), thumb: new Blob(["x"]) };

/** Servidor falso: registra [operação, cachorro do cabeçalho]; a primeira chamada só responde quando liberada. */
function fakeServer() {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const calls: [string, string | undefined][] = [];
  let first = true;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const method = url.split("/").pop()!;
    calls.push([method, (init.headers as Record<string, string>)["x-ddp-dog"]]);
    if (first) { first = false; await gate; }
    if (method === "entryByRequestKey") return Response.json(null);
    if (method === "createUpload") return Response.json({ id: "media", bucket: "media", uploads: [{ variant: "display", path: "p", token: "t" }] });
    return Response.json({ id: "x" });
  }));
  return { calls, release };
}

afterEach(() => { vi.unstubAllGlobals(); setActiveDog(null); });

describe("cachorro fixo durante a operação inteira", () => {
  const cases: [string, (r: ReturnType<typeof realRepository>) => Promise<unknown>][] = [
    ["foto (conferir, enviar, confirmar, salvar)", (r) => r.saveEntry({ requestKey: "k", image: img, caption: "", occurredDate: "2026-10-20", source: "free", missionId: null, albumIds: [] } as never)],
    ["documento (enviar, confirmar, buscar)", (r) => r.addDocument({ title: "Exame", category: "exams", docDate: null } as never, { mime: "application/pdf", file: new Blob(["%PDF"]), thumb: null } as never)],
    ["foto do perfil (enviar, confirmar, salvar)", (r) => r.updateDog({ photo: img } as never)],
    ["álbum novo", (r) => r.createAlbum("Passeios")],
    ["peso", (r) => r.addWeight({ date: "2026-10-20", kg: 10 })],
    ["vacina", (r) => r.saveVaccine({ name: "V10" } as never)],
    ["missão confirmada", (r) => r.submitMission({ requestKey: "k", missionId: "M01", entryId: "e", status: "approved", reasonCode: "OWNER_CONFIRMED", mode: "owner", providerVersion: null } as never)],
  ];
  for (const [name, op] of cases) {
    it(name, async () => {
      const server = fakeServer();
      setActiveDog("abu");
      const p = op(realRepository());
      await new Promise((r) => setTimeout(r, 10));
      setActiveDog("pepe"); // a pessoa troca de cachorro enquanto espera
      server.release();
      await p;
      expect(server.calls.length).toBeGreaterThan(0);
      expect(server.calls.every(([, dog]) => dog === "abu")).toBe(true);
    });
  }
  it("foto: 1ª tentativa vai direto (envio conferido junto do salvamento); a repetição procura a anterior, no cachorro capturado", async () => {
    const server = fakeServer();
    server.release();
    setActiveDog("pepe");
    const input = { requestKey: "k-repeticao", image: img, caption: "", occurredDate: "2026-10-20", source: "free", missionId: null, albumIds: [], dogId: "abu" } as never;
    await realRepository().saveEntry(input);
    expect(server.calls.map(([m, d]) => `${m}:${d}`)).toEqual(["createUpload:abu", "saveEntry:abu"]);
    server.calls.length = 0;
    await realRepository().saveEntry(input); // a resposta da 1ª se perdeu: a pessoa toca de novo
    expect(server.calls.map(([m, d]) => `${m}:${d}`)).toEqual(["entryByRequestKey:abu", "createUpload:abu", "saveEntry:abu"]);
  });
});
