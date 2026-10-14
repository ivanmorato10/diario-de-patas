import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { combineChecks, localPhotoMetrics } from "./photo-quality";

const good = { minSide: 1024, brightness: 130, sharpness: 300 };
const dog = { dogs: 1, faceVisible: true, dogSize: "ok" as const, sharp: true };

describe("validação da foto do Estúdio", () => {
  it("foto boa passa sem avisos", () => {
    expect(combineChecks(good, dog)).toEqual({ verdict: "good", issues: [] });
  });
  it("sem cachorro, rosto escondido ou foto minúscula bloqueiam (sem cobrar)", () => {
    expect(combineChecks(good, { ...dog, dogs: 0 }).verdict).toBe("bad");
    expect(combineChecks(good, { ...dog, faceVisible: false }).issues.map((i) => i.code)).toContain("FACE_HIDDEN");
    expect(combineChecks({ ...good, minSide: 200 }, dog).verdict).toBe("bad");
  });
  it("escura, tremida, cachorro pequeno ou vários cachorros só avisam", () => {
    const c = combineChecks({ ...good, brightness: 20, sharpness: 5 }, { ...dog, dogs: 2, dogSize: "small" });
    expect(c.verdict).toBe("warn");
    expect(c.issues.map((i) => i.code).sort()).toEqual(["BLURRY", "DARK", "MANY_DOGS", "SMALL_DOG"]);
  });
  it("se a IA falhar, valem só as checagens locais", () => {
    expect(combineChecks(good, null).verdict).toBe("good");
  });
  it("mede luz e foco de verdade", async () => {
    const dark = await sharp({ create: { width: 600, height: 600, channels: 3, background: { r: 10, g: 10, b: 10 } } }).jpeg().toBuffer();
    const m = await localPhotoMetrics(dark);
    expect(m.minSide).toBe(600);
    expect(m.brightness).toBeLessThan(70);
    expect(m.sharpness).toBeLessThan(120); // imagem lisa = sem foco
    const noisy = await sharp(Buffer.from(Array.from({ length: 300 * 300 * 3 }, (_, i) => ((i * 7919) % 251))), { raw: { width: 300, height: 300, channels: 3 } }).png().toBuffer();
    expect((await localPhotoMetrics(noisy)).sharpness).toBeGreaterThan(120);
  });
});
