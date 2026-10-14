/**
 * Validação da foto antes de gastar crédito no Estúdio: foto ruim = arte ruim = experiência ruim.
 * 1) Checagens locais, grátis (sharp): resolução, luz e foco (variância do Laplaciano).
 * 2) Checagem barata com IA (modelo "check", ~US$ 0,0002): há cachorro? quantos? rosto visível? tamanho na foto?
 * Veredito: "bad" bloqueia a criação (sem cobrar); "warn" avisa e deixa seguir; "good" segue.
 */
import "server-only";
import sharp from "sharp";
import type { ArtGenerator, PhotoAssessment } from "./art-generator";

export type PhotoVerdict = "good" | "warn" | "bad";
export interface PhotoIssue { code: string; level: "warn" | "bad"; message: string }
/** `aiChecked` falso = a IA não conferiu (sem chave ou erro): nunca dizer "foto boa" nesse caso. */
export interface PhotoCheck { verdict: PhotoVerdict; issues: PhotoIssue[]; aiChecked: boolean }

export const PHOTO_ISSUES: Record<string, Omit<PhotoIssue, "code">> = {
  NO_DOG: { level: "bad", message: "Não encontramos um cachorro nesta foto. Escolha uma em que ele apareça bem." },
  FACE_HIDDEN: { level: "bad", message: "O rostinho não aparece bem (de costas, coberto ou cortado). A arte precisa ver o focinho e os olhos." },
  LOW_RES: { level: "bad", message: "A foto é pequena demais para virar arte. Use uma foto com mais resolução." },
  MANY_DOGS: { level: "warn", message: "Tem mais de um cachorro: a arte usa só o que aparece mais. Use o recorte para escolher." },
  SMALL_DOG: { level: "warn", message: "O cachorro aparece pequeno na foto. Use o recorte para aproximar." },
  BLURRY: { level: "warn", message: "A foto parece tremida ou desfocada. A arte pode perder detalhes." },
  DARK: { level: "warn", message: "A foto está escura. Fotos com boa luz dão artes mais bonitas." },
  BRIGHT: { level: "warn", message: "A foto está muito clara (estourada). A arte pode perder as cores do pelo." },
  LOW_RES_WARN: { level: "warn", message: "A foto tem pouca resolução. A arte pode ficar menos detalhada." },
};

const issue = (code: keyof typeof PHOTO_ISSUES): PhotoIssue => ({ code, ...PHOTO_ISSUES[code] });

/** Métricas locais (grátis). */
export async function localPhotoMetrics(input: Buffer) {
  const meta = await sharp(input).rotate().metadata();
  const minSide = Math.min(meta.width ?? 0, meta.height ?? 0);
  const gray = sharp(input).rotate().resize(512, 512, { fit: "inside" }).greyscale();
  const brightness = (await gray.clone().stats()).channels[0].mean;
  // Foco: variância da borda (Laplaciano) — foto tremida tem poucas bordas nítidas.
  const lap = await gray.clone().convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: 128 }).stats();
  const sharpness = lap.channels[0].stdev ** 2;
  return { minSide, brightness, sharpness };
}

export function combineChecks(local: Awaited<ReturnType<typeof localPhotoMetrics>>, ai: PhotoAssessment | null): PhotoCheck {
  const issues: PhotoIssue[] = [];
  if (local.minSide < 256) issues.push(issue("LOW_RES"));
  else if (local.minSide < 480) issues.push(issue("LOW_RES_WARN"));
  if (local.brightness < 70) issues.push(issue("DARK"));
  else if (local.brightness > 235) issues.push(issue("BRIGHT"));
  if (local.sharpness < 120 || (ai && ai.sharp === false)) issues.push(issue("BLURRY"));
  if (ai) {
    if (ai.dogs === 0) issues.push(issue("NO_DOG"));
    else {
      if (!ai.faceVisible) issues.push(issue("FACE_HIDDEN"));
      if (ai.dogs > 1) issues.push(issue("MANY_DOGS"));
      if (ai.dogSize === "small") issues.push(issue("SMALL_DOG"));
    }
  }
  const verdict: PhotoVerdict = issues.some((i) => i.level === "bad") ? "bad" : issues.length || !ai ? "warn" : "good";
  return { verdict, issues, aiChecked: !!ai };
}

/** Avalia a foto (já recortada). Se a IA falhar, fica só com as checagens locais — nunca bloqueia por erro nosso. */
export async function assessPhoto(input: Buffer, gen: ArtGenerator | null): Promise<PhotoCheck> {
  const local = await localPhotoMetrics(input);
  let ai: PhotoAssessment | null = null;
  if (gen) {
    const small = await sharp(input).rotate().resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    ai = await gen.assessPhoto(small, "image/jpeg").catch(() => null);
  }
  return combineChecks(local, ai);
}
