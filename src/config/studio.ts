/**
 * Estúdio (MUDANCAS-V2 §9 + adendo §10). Fonte única de presets, prompts, créditos e limites.
 * Prompts em inglês (resultados mais estáveis); interface em português. O usuário NUNCA escreve prompt:
 * o servidor junta [BASE] + [PRESET] + [FORMATO]. Mudar um prompt = subir `version` (o job grava a versão).
 */

export type StudioCategory = "datas" | "estilos" | "fantasias" | "formatos";
export type StudioAspect = "1:1" | "4:5" | "9:16";
export type PostProcess = "none" | "sticker" | "wallpaper" | "card" | "cover";

export interface StudioPreset {
  id: string;
  version: number;
  category: StudioCategory;
  labelPt: string;
  prompt: string;
  /** Proporção padrão e as que a pessoa pode escolher. */
  aspect: StudioAspect;
  aspects: StudioAspect[];
  credits: number;
  premium: boolean;
  /** Nome/mensagem desenhados pelo app por cima (nunca pela IA). */
  addTextOverlay: boolean;
  /** Texto pronto sugerido para a mensagem (ex.: “Feliz Dia das Mães”). */
  overlayHint?: string;
  post: PostProcess;
  /** Padrão no código; pode ser desligado sem deploy na tabela studio_presets (§10.7). */
  enabled: boolean;
}

export const STUDIO_TABS: { id: StudioCategory; labelPt: string }[] = [
  { id: "datas", labelPt: "Datas" },
  { id: "estilos", labelPt: "Estilos" },
  { id: "fantasias", labelPt: "Fantasias" },
  { id: "formatos", labelPt: "Formatos" },
];

/** [BASE] — enviado em toda geração (§10.2). */
export const STUDIO_BASE_PROMPT =
  "Use the attached photo as the only reference for the dog. Keep it recognizably the same individual dog: same breed traits, the same coat colors and markings in the same places, the same ear shape and position, muzzle shape, eye color and body proportions. If a collar is visible, keep its color. If the photo shows more than one dog, use only the most prominent one. Do not add other animals or any people. Do not write any text, letters, numbers, logos, signatures or watermarks anywhere in the image. The dog must look healthy, relaxed and happy, never in danger, distress, pain or wearing anything that restricts its movement or covers its eyes, nose or mouth. Keep the dog as the clear main subject, with the whole head fully visible and not cropped.";

/** [FORMATO] (§10.2). */
export const STUDIO_FORMATS: Record<StudioAspect, { labelPt: string; prompt: string }> = {
  "1:1": { labelPt: "Quadrado", prompt: "Square composition, subject centered with breathing room around it." },
  "4:5": { labelPt: "Retrato", prompt: "Vertical portrait composition, subject in the upper two thirds, calm area at the bottom." },
  "9:16": { labelPt: "Papel de parede", prompt: "Tall phone wallpaper composition, subject in the middle third, simple uncluttered areas at the top and bottom for the clock and icons." },
};

const ALL: StudioAspect[] = ["1:1", "4:5", "9:16"];
const p = (x: Partial<StudioPreset> & Pick<StudioPreset, "id" | "category" | "labelPt" | "prompt">): StudioPreset => ({
  version: 1, aspect: "1:1", aspects: ALL, credits: 1, premium: false, addTextOverlay: false, post: "none", enabled: true, ...x,
});

export const STUDIO_PRESETS: StudioPreset[] = [
  // ---------- Datas (§10.3) ----------
  p({ id: "aniversario", category: "datas", labelPt: "Aniversário", addTextOverlay: true, overlayHint: "Feliz aniversário!", prompt: "A joyful birthday illustration: the dog wearing a small soft party hat, sitting next to a dog-safe birthday cake with one candle, colorful balloons and confetti floating in a bright cheerful room. Warm soft lighting, festive pastel colors, charming editorial illustration style." }),
  p({ id: "natal", category: "datas", labelPt: "Natal acolhedor", addTextOverlay: true, overlayHint: "Feliz Natal!", prompt: "A cozy Christmas scene: the dog resting on a soft knitted blanket beside a decorated Christmas tree with warm glowing fairy lights and wrapped presents. Gentle warm light, red, green and gold tones, storybook illustration style." }),
  p({ id: "halloween", category: "datas", labelPt: "Halloween divertido", addTextOverlay: true, overlayHint: "Feliz Halloween!", prompt: "A cute, not scary Halloween scene: the dog sitting among carved smiling pumpkins, autumn leaves and paper bats, with a tiny soft witch hat or a comfortable orange bandana. Playful purple and orange tones, friendly children's book illustration style." }),
  p({ id: "dia-dos-animais", category: "datas", labelPt: "Dia dos Animais (4/10)", addTextOverlay: true, overlayHint: "Feliz Dia dos Animais!", prompt: "A sunny celebration in a green park: the dog surrounded by flowers and gentle sunlight, with soft bokeh and small floating paw-print shapes in the sky. Joyful, warm, hopeful mood, soft illustration style." }),
  p({ id: "festa-junina", category: "datas", labelPt: "Festa Junina", addTextOverlay: true, overlayHint: "Arraiá!", prompt: "A Brazilian Festa Junina scene: the dog wearing a small checkered (plaid) bandana, colorful paper flag garlands (bandeirinhas) overhead, a warm bonfire glow at a safe distance in the background and a straw hat resting beside it. Cozy evening light, festive and rustic illustration style." }),
  p({ id: "pascoa", category: "datas", labelPt: "Páscoa", addTextOverlay: true, overlayHint: "Feliz Páscoa!", prompt: "A gentle spring scene: the dog in a meadow with pastel decorated eggs in a basket (eggs are not being eaten) and soft spring flowers. Pastel colors, light and airy illustration style." }),
  p({ id: "ano-novo", category: "datas", labelPt: "Ano Novo", addTextOverlay: true, overlayHint: "Feliz Ano Novo!", prompt: "A New Year's night celebration: the dog wearing a small shiny party bow, sitting by a window with colorful fireworks far away in the night sky and soft golden sparkles. The dog looks calm and safe indoors. Elegant night colors, glowing illustration style." }),
  p({ id: "dia-das-maes-pet", category: "datas", labelPt: "Mãe/Pai de pet", addTextOverlay: true, overlayHint: "Feliz Dia das Mães", prompt: "A tender portrait of the dog holding a small bouquet of flowers in a soft pastel setting with a heart-shaped soft-focus background. Loving, warm mood, gentle watercolor-like illustration style." }),
  // ---------- Estilos (§10.4) ----------
  p({ id: "estilo-diario", category: "estilos", labelPt: "Estilo Diário de Patas", prompt: "Transform the photo into a clean 2D cartoon illustration with soft brown outlines, rounded friendly shapes, warm flat colors with subtle shading, on a soft aqua circular background — like a cute app mascot. Keep the dog's real markings." }),
  p({ id: "aquarela", category: "estilos", labelPt: "Aquarela", prompt: "A delicate watercolor painting of the dog: soft washes, visible paper texture, gentle color bleeding at the edges, white background with loose splashes." }),
  p({ id: "lapis", category: "estilos", labelPt: "Desenho a lápis", prompt: "A detailed graphite pencil drawing of the dog on cream paper: fine hatching, soft shading, realistic fur texture, a few loose sketch lines at the edges." }),
  p({ id: "oleo-classico", category: "estilos", labelPt: "Retrato clássico", premium: true, credits: 2, aspect: "4:5", prompt: "A classic oil painting portrait in the style of 18th-century European court portraits: the dog posed nobly on a velvet cushion, dark warm background, rich textured brushstrokes, soft dramatic lighting. Dignified and charming." }),
  p({ id: "pop-art", category: "estilos", labelPt: "Pop art", prompt: "A bold pop art print of the dog: flat vivid color blocks, thick black outlines, halftone dot shading, bright contrasting background." }),
  p({ id: "3d-fofo", category: "estilos", labelPt: "Animação 3D", prompt: "A cute high-quality 3D animated movie style render of the dog: soft rounded shapes, big expressive but natural eyes, glossy fur, warm cinematic lighting, simple colorful background. Original character design, not resembling any existing film character." }),
  p({ id: "pixel", category: "estilos", labelPt: "Pixel art", prompt: "Retro 16-bit pixel art of the dog: limited color palette, crisp pixels, simple pastel background, like a cozy video game sprite portrait." }),
  p({ id: "vitral", category: "estilos", labelPt: "Vitral", prompt: "The dog depicted as a colorful stained glass window: bold dark lead lines, glowing jewel-toned glass pieces, light shining through." }),
  // ---------- Fantasias (§10.5) — roupa confortável e solta; nada cobrindo olhos, nariz ou boca ----------
  p({ id: "astronauta", category: "fantasias", labelPt: "Astronauta", prompt: "The dog as a cute astronaut floating in space wearing an open-face spacesuit (no helmet glass over the face), stars, a small planet and a friendly rocket in the background. Whimsical illustration style." }),
  p({ id: "super-heroi", category: "fantasias", labelPt: "Super-herói", prompt: "The dog as an original superhero with a flowing cape and a simple paw emblem on the chest (no existing superhero logos or costumes), standing proudly on a rooftop at sunset. Dynamic comic illustration style." }),
  p({ id: "realeza", category: "fantasias", labelPt: "Realeza", premium: true, credits: 2, aspect: "4:5", prompt: "The dog as royalty: a small golden crown, a red velvet royal cape with white trim, sitting on an ornate throne in a grand palace hall. Rich painterly style." }),
  p({ id: "chef", category: "fantasias", labelPt: "Chef", prompt: "The dog as a chef wearing a small white chef hat and apron in a cozy kitchen, next to dog-safe treats on the counter (no chocolate, grapes, onions or other foods toxic to dogs). Warm illustration style." }),
  p({ id: "explorador", category: "fantasias", labelPt: "Explorador", prompt: "The dog as a jungle explorer with a small safari hat and a little backpack, in a lush green jungle with friendly parrots far in the background. Adventure storybook style." }),
  p({ id: "detetive", category: "fantasias", labelPt: "Detetive", prompt: "The dog as a classic detective with a small tweed cap and a magnifying glass, on a cozy old street at night under a warm lamp light. Charming noir illustration style, not dark or scary." }),
  p({ id: "surfista", category: "fantasias", labelPt: "Surfista", prompt: "The dog on a beach at sunset next to a colorful surfboard stuck in the sand (the dog is on the sand, not in the waves), wearing a flower lei. Bright tropical illustration style." }),
  p({ id: "futebol", category: "fantasias", labelPt: "Craque do futebol", prompt: "The dog as a soccer star on a green field with a soccer ball, wearing a plain yellow and green bandana (no team crests, no brand logos, no real kits). Energetic sports illustration style." }),
  // ---------- Formatos (§10.6) ----------
  p({ id: "figurinha", category: "formatos", labelPt: "Figurinha para WhatsApp", aspect: "1:1", aspects: ["1:1"], post: "sticker", prompt: "A cute die-cut sticker of the dog's head and shoulders in a clean cartoon style, thick white outline around the whole shape, on a plain solid flat light green background (#00FF00) for easy removal, no shadow." }),
  p({ id: "papel-de-parede", category: "formatos", labelPt: "Papel de parede", aspect: "9:16", aspects: ["9:16"], post: "wallpaper", prompt: "A calm, beautiful illustrated scene with the dog resting in a soft dreamy landscape, gentle gradient sky, plenty of simple space." }),
  p({ id: "cartao", category: "formatos", labelPt: "Cartão com mensagem", aspect: "4:5", aspects: ["4:5", "1:1"], post: "card", addTextOverlay: true, prompt: "A clean illustrated portrait of the dog with a soft solid pastel background and generous empty space at the bottom third." }),
  p({ id: "capa-album", category: "formatos", labelPt: "Capa do álbum", aspect: "4:5", aspects: ["4:5", "1:1"], post: "cover", prompt: "A warm illustrated cover-style portrait of the dog, centered, with a soft decorative frame of small paw prints and leaves around the edges." }),
];

/** Modelos (conferidos em ai.google.dev em 12/10/2026). Podem ser trocados por variável de ambiente. */
export const STUDIO_MODELS = {
  normal: "gemini-nano-banana-2.1",
  premium: "gemini-3-pro-image",
  /** Checagem barata “há cachorro? há texto?” — só para devolver crédito, nunca para julgar a foto. */
  check: "gemini-3.5-flash-lite",
} as const;

/** Custo estimado por arte em US$ (preços oficiais de 12/10/2026; confirmar antes de definir preço). */
export const STUDIO_COST_USD = { normal1K: 0.0336, normal2K: 0.0504, premium: 0.134, inputAndText: 0.002, check: 0.0001 } as const;

/** Tamanho pedido ao modelo: papel de parede em 2K (resolução de celular); o resto em 1K. */
export const imageSizeFor = (aspect: StudioAspect) => (aspect === "9:16" ? "2K" : "1K");

export function estimateCostUsd(preset: StudioPreset, aspect: StudioAspect): number {
  const out = preset.premium ? STUDIO_COST_USD.premium : imageSizeFor(aspect) === "2K" ? STUDIO_COST_USD.normal2K : STUDIO_COST_USD.normal1K;
  return Math.round((out + STUDIO_COST_USD.inputAndText + STUDIO_COST_USD.check) * 10000) / 10000;
}

export const presetById = (id: string) => STUDIO_PRESETS.find((x) => x.id === id);

/** Monta o prompt no servidor: [BASE] + [PRESET] + [FORMATO]. Nenhum texto do usuário entra aqui. */
export function buildStudioPrompt(preset: StudioPreset, aspect: StudioAspect): string {
  const a = preset.aspects.includes(aspect) ? aspect : preset.aspect;
  return [STUDIO_BASE_PROMPT, preset.prompt, STUDIO_FORMATS[a].prompt].join("\n\n");
}

/** Limites de custo (variáveis de ambiente no servidor; estes são os padrões). */
export const STUDIO_DEFAULTS = { testCredits: 5, dailyPerAccount: 5, maxDailyGenerations: 50, jobTimeoutMinutes: 10 } as const;
