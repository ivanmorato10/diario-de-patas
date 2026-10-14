/**
 * Gerador de artes — SÓ no servidor (MUDANCAS-V2 §9.2). Adapter trocável; chave em variável de ambiente.
 * Provedor escolhido: Google Gemini (adendo A), API Interactions com `store: false` (nada guardado do lado deles
 * além do registro de abuso por tempo limitado). Sem foto de referência não existe geração: nunca uma imagem genérica.
 */
import "server-only";
import { STUDIO_MODELS, type StudioAspect } from "@/config/studio";

export class ProviderError extends Error {
  constructor(readonly code: "PROVIDER_REFUSED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_TIMEOUT" | "NOT_CONFIGURED" | "QUALITY_REJECTED", message: string) {
    super(message);
  }
}

export interface GenerateInput {
  image: Buffer;
  mime: string;
  prompt: string;
  aspect: StudioAspect;
  imageSize: "1K" | "2K";
  premium: boolean;
}

export interface ArtGenerator {
  readonly configured: boolean;
  readonly provider: string;
  modelFor(premium: boolean): string;
  generate(input: GenerateInput): Promise<{ image: Buffer; mime: string; model: string }>;
  /** Checagem barata só para devolver crédito: há um cachorro? há texto escrito? */
  check(image: Buffer, mime: string): Promise<{ dog: boolean; text: boolean }>;
  /** Avaliação barata da FOTO de entrada, antes de cobrar (src/server/photo-quality.ts). */
  assessPhoto(image: Buffer, mime: string): Promise<PhotoAssessment>;
}

export interface PhotoAssessment { dogs: number; faceVisible: boolean; dogSize: "small" | "ok"; sharp: boolean }

const API = "https://generativelanguage.googleapis.com/v1beta";

/** Procura a primeira imagem (base64) na resposta, tolerando variações de formato. */
export function extractImage(json: unknown): { data: string; mime: string } | null {
  const stack: unknown[] = [json];
  while (stack.length) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    if (o.type === "image" && typeof o.data === "string" && o.data.length > 100) return { data: o.data, mime: typeof o.mime_type === "string" ? o.mime_type : "image/png" };
    const inline = (o.inline_data ?? o.inlineData) as Record<string, unknown> | undefined;
    if (inline && typeof inline.data === "string") return { data: inline.data, mime: String(inline.mime_type ?? inline.mimeType ?? "image/png") };
    for (const child of Object.values(o)) if (child && typeof child === "object") stack.push(child);
  }
  return null;
}

/** Recusa ou falha do provedor numa resposta 200 (status failed/incomplete, erros, bloqueio de segurança). */
export function refusalOf(json: unknown): string | null {
  const o = (json ?? {}) as Record<string, unknown>;
  if (o.status === "failed" || o.status === "incomplete" || o.status === "cancelled") return String(o.status);
  if (Array.isArray(o.errors) && o.errors.length) return "errors";
  const text = JSON.stringify(json ?? "");
  if (/"(blockReason|block_reason)"|"finishReason":"(SAFETY|PROHIBITED_CONTENT|IMAGE_SAFETY)"/.test(text)) return "safety";
  return null;
}

async function post(path: string, key: string, body: unknown, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}/${path}`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: ctrl.signal });
    const json = await res.json().catch(() => null);
    if (res.status === 400 || res.status === 403) {
      // Pedido/foto recusados pela política do provedor (ou chave inválida — aparece no log do servidor).
      console.error("gemini", res.status, JSON.stringify(json)?.slice(0, 300));
      throw new ProviderError("PROVIDER_REFUSED", "O provedor recusou o pedido.");
    }
    if (!res.ok) throw new ProviderError("PROVIDER_UNAVAILABLE", `Provedor indisponível (${res.status}).`);
    return json;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if ((e as Error).name === "AbortError") throw new ProviderError("PROVIDER_TIMEOUT", "O provedor demorou demais.");
    throw new ProviderError("PROVIDER_UNAVAILABLE", "Não conseguimos falar com o provedor.");
  } finally {
    clearTimeout(t);
  }
}

export function geminiGenerator(key: string): ArtGenerator {
  const modelFor = (premium: boolean) => (premium ? process.env.STUDIO_MODEL_PREMIUM || STUDIO_MODELS.premium : process.env.STUDIO_MODEL_NORMAL || STUDIO_MODELS.normal);
  return {
    configured: true,
    provider: "gemini",
    modelFor,
    async generate(input) {
      const model = modelFor(input.premium);
      const json = await post("interactions", key, {
        model,
        store: false,
        input: [
          { type: "text", text: input.prompt },
          { type: "image", mime_type: input.mime, data: input.image.toString("base64") },
        ],
        response_format: { type: "image", aspect_ratio: input.aspect, image_size: input.imageSize },
      }, 150_000);
      const refused = refusalOf(json);
      const img = extractImage(json);
      if (refused || !img) throw new ProviderError("PROVIDER_REFUSED", "O provedor não devolveu a imagem.");
      return { image: Buffer.from(img.data, "base64"), mime: img.mime, model };
    },
    async check(image, mime) {
      const model = process.env.STUDIO_MODEL_CHECK || STUDIO_MODELS.check;
      const json = await post(`models/${model}:generateContent`, key, {
        contents: [{ parts: [
          { text: 'Look at this illustration. Answer only JSON: {"dog": true|false, "text": true|false}. "dog": is there a dog clearly visible as the main subject? "text": are there any written letters, words or numbers anywhere?' },
          { inline_data: { mime_type: mime, data: image.toString("base64") } },
        ] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }, 30_000);
      const raw = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      try {
        const r = JSON.parse(raw);
        return { dog: r.dog === true, text: r.text === true };
      } catch {
        return { dog: true, text: false }; // checagem inconclusiva não pune ninguém: segue com a arte
      }
    },
    async assessPhoto(image, mime) {
      const model = process.env.STUDIO_MODEL_CHECK || STUDIO_MODELS.check;
      const json = await post(`models/${model}:generateContent`, key, {
        contents: [{ parts: [
          { text: 'You check if a photo is good input to turn a pet dog into an illustration. Answer only JSON: {"dogs": number of real dogs visible, "faceVisible": true if the main dog\'s face (eyes and muzzle) is clearly visible and not turned away, covered or cut off, "dogSize": "small" if the main dog fills less than about 15% of the photo else "ok", "sharp": false only if the dog is clearly blurry}.' },
          { inline_data: { mime_type: mime, data: image.toString("base64") } },
        ] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }, 30_000);
      const raw = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const r = JSON.parse(raw);
      return { dogs: Math.max(0, Math.round(Number(r.dogs) || 0)), faceVisible: r.faceVisible !== false, dogSize: r.dogSize === "small" ? "small" : "ok", sharp: r.sharp !== false };
    },
  };
}

/**
 * Gerador de TESTE (E2E local): devolve uma variação colorida da própria foto, claramente não é IA.
 * Só existe com STUDIO_ALLOW_FAKE=1 e fora da Vercel — nunca em produção.
 */
export function fakeGenerator(): ArtGenerator {
  return {
    configured: true,
    provider: "teste",
    modelFor: () => "teste-local",
    async generate(input) {
      const sharp = (await import("sharp")).default;
      const image = await sharp(input.image).resize(512, 512, { fit: "cover" }).tint({ r: 255, g: 180, b: 120 }).webp().toBuffer();
      return { image, mime: "image/webp", model: "teste-local" };
    },
    async check() {
      return { dog: true, text: false };
    },
    async assessPhoto() {
      return { dogs: 1, faceVisible: true, dogSize: "ok", sharp: true };
    },
  };
}

export function artGenerator(): ArtGenerator | null {
  if (process.env.STUDIO_ALLOW_FAKE === "1" && !process.env.VERCEL) return fakeGenerator();
  const provider = (process.env.ART_GENERATOR_PROVIDER || "gemini").toLowerCase();
  const key = process.env.ART_GENERATOR_API_KEY || process.env.GEMINI_API_KEY;
  if (provider !== "gemini" || !key) return null; // sem provedor configurado: Estúdio mostra “indisponível”, nada é simulado
  return geminiGenerator(key);
}
