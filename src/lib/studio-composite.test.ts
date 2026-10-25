/** Regressão (auditoria 23/10/2026, item 8): arte com nome/mensagem guarda a versão composta, uma vez. */
import { describe, expect, it, vi } from "vitest";
vi.mock("@/data/real-repository", () => ({ rpc: vi.fn(), uploadMediaFor: vi.fn() }));
import { needsComposite } from "./studio-composite";

const job = (over: Record<string, unknown>) => ({ id: "j", presetId: "cartao", state: "succeeded", outputMediaId: "m", compositeMediaId: null, overlay: { name: "Luna", message: "Feliz aniversário" }, ...over }) as never;

describe("arte composta", () => {
  it("guarda quando há texto para desenhar e ainda não foi guardada", () => {
    expect(needsComposite(job({}))).toBe(true);
  });
  it("não guarda: já guardada, sem texto, sem arte ou ainda gerando", () => {
    expect(needsComposite(job({ compositeMediaId: "c" }))).toBe(false);
    expect(needsComposite(job({ overlay: { name: " ", message: "" } }))).toBe(false);
    expect(needsComposite(job({ outputMediaId: null }))).toBe(false);
    expect(needsComposite(job({ state: "processing" }))).toBe(false);
  });
});
