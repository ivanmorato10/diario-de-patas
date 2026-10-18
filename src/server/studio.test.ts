import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  STUDIO_BASE_PROMPT, STUDIO_FORMATS, STUDIO_PRESETS, STUDIO_TABS, buildStudioPrompt, estimateCostUsd, presetById,
} from "@/config/studio";
import { extractImage, refusalOf } from "./art-generator";
import { stickerFromGreen } from "./studio";

describe("presets do Estúdio (adendo §10)", () => {
  it("variantes ilustradas: datas e fantasias, com o prompt antigo e os mesmos créditos", () => {
    const v = STUDIO_PRESETS.filter((p) => p.variantOf);
    expect(v.map((p) => p.variantOf).sort()).toEqual(["aniversario", "ano-novo", "astronauta", "chef", "detetive", "dia-dos-animais", "explorador", "festa-junina", "futebol", "halloween", "natal", "pascoa", "realeza", "super-heroi", "surfista"]);
    for (const p of v) {
      expect(p.prompt).toMatch(/illustration|style/);
      expect(presetById(p.variantOf!)!.prompt).toMatch(/not an illustration/);
      expect(p.credits).toBe(presetById(p.variantOf!)!.credits);
    }
  });
  it("4 abas e 28 presets com ids únicos e campos completos", () => {
    expect(STUDIO_TABS.map((t) => t.id)).toEqual(["datas", "estilos", "fantasias", "formatos"]);
    expect(STUDIO_PRESETS.filter((p) => !p.variantOf)).toHaveLength(28);
    expect(new Set(STUDIO_PRESETS.map((p) => p.id)).size).toBe(STUDIO_PRESETS.length);
    const per = Object.fromEntries(STUDIO_TABS.map((t) => [t.id, STUDIO_PRESETS.filter((p) => p.category === t.id && !p.variantOf).length]));
    expect(per).toEqual({ datas: 8, estilos: 8, fantasias: 8, formatos: 4 });
    for (const p of STUDIO_PRESETS) {
      expect(p.version).toBeGreaterThanOrEqual(1);
      expect(p.prompt.length).toBeGreaterThan(40);
      expect(p.aspects).toContain(p.aspect);
    }
  });
  it("premium custa 2 créditos e usa o modelo premium; os outros, 1", () => {
    expect(STUDIO_PRESETS.filter((p) => p.premium && !p.variantOf).map((p) => p.id).sort()).toEqual(["oleo-classico", "realeza"]);
    expect(STUDIO_PRESETS.every((p) => p.credits === (p.premium ? 2 : 1))).toBe(true);
  });
  it("o prompt é montado pelo servidor: [BASE] + [PRESET] + [FORMATO], sem nada do usuário", () => {
    const p = presetById("natal")!;
    const prompt = buildStudioPrompt(p, "4:5");
    expect(prompt.startsWith(STUDIO_BASE_PROMPT)).toBe(true);
    expect(prompt).toContain(p.prompt);
    expect(prompt.endsWith(STUDIO_FORMATS["4:5"].prompt)).toBe(true);
    expect(buildStudioPrompt(presetById("figurinha")!, "9:16")).toContain(STUDIO_FORMATS["1:1"].prompt); // proporção fora do preset → padrão
    expect(buildStudioPrompt.length).toBe(2); // não aceita texto livre
  });
  it("nenhum prompt cita marcas, times, personagens ou artistas reais", () => {
    const forbidden = /\b(disney|pixar|marvel|dc comics|batman|superman|spider|nike|adidas|flamengo|corinthians|palmeiras|brasil national|van gogh|picasso|banksy)\b/i;
    expect(STUDIO_PRESETS.filter((p) => forbidden.test(p.prompt)).map((p) => p.id)).toEqual([]);
  });
  it("estimativa de custo por arte (US$)", () => {
    expect(estimateCostUsd(presetById("aquarela")!, "1:1")).toBeCloseTo(0.0357, 3);
    expect(estimateCostUsd(presetById("papel-de-parede")!, "9:16")).toBeCloseTo(0.0525, 3);
    expect(estimateCostUsd(presetById("realeza")!, "4:5")).toBeCloseTo(0.1361, 3);
  });
});

describe("resposta do Gemini", () => {
  const big = "A".repeat(200);
  it("acha a imagem em steps[].content[] e em inline_data", () => {
    expect(extractImage({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: "ok" }, { type: "image", mime_type: "image/png", data: big }] }] })).toEqual({ data: big, mime: "image/png" });
    expect(extractImage({ candidates: [{ content: { parts: [{ inline_data: { mime_type: "image/jpeg", data: big } }] } }] })?.mime).toBe("image/jpeg");
    expect(extractImage({ steps: [{ content: [{ type: "text", text: "não posso" }] }] })).toBeNull();
  });
  it("reconhece recusa e falha", () => {
    expect(refusalOf({ status: "failed" })).toBe("failed");
    expect(refusalOf({ status: "completed", errors: [{ code: 3 }] })).toBe("errors");
    expect(refusalOf({ promptFeedback: { blockReason: "SAFETY" } })).toBe("safety");
    expect(refusalOf({ status: "completed", steps: [] })).toBeNull();
  });
});

describe("figurinha (adendo §10.6)", () => {
  it("tira o fundo verde e exporta WebP 512×512 transparente com até 100 KB", async () => {
    const dog = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 150, g: 90, b: 40 } } }).png().toBuffer();
    const input = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: 0, g: 255, b: 0 } } }).composite([{ input: dog, left: 362, top: 362 }]).png().toBuffer();
    const out = await stickerFromGreen(input);
    const meta = await sharp(out).metadata();
    expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(["webp", 512, 512, true]);
    expect(out.length).toBeLessThanOrEqual(100 * 1024);
    const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0); // canto transparente
    const c = (256 * 512 + 256) * 4;
    expect(data[c + 3]).toBe(255); // centro (o cachorro) opaco
  });
});
