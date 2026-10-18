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
  /** Versão ilustrada do mesmo tema (a pessoa escolhe "Realista" ou "Ilustração"). */
  illustration?: string;
  /** Variante gerada a partir de outro tema (não aparece sozinha na vitrine; segue os ajustes do tema original). */
  variantOf?: string;
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

/**
 * Acabamento FOTOGRÁFICO, para os temas cujo exemplo é uma foto produzida (não um desenho).
 * Os temas de estilo (aquarela, lápis, pixel…) continuam com o estilo do próprio exemplo.
 */
export const PHOTO_STYLE =
  "Bright warm golden window light with soft, consistent shadows; highly saturated, vibrant, festive candy colors and a fun, celebratory mood (never washed out, dull or serious). " +
  "Natural fur texture with fine individual strands, natural anatomy and real proportions, sharp focus on the eyes, shallow depth of field like an 85mm lens at f/2. " +
  "Keep the dog's true coat color under the scene lighting (a white dog stays white, a black dog stays black). " +
  "Photorealistic: not a drawing, painting, watercolor, sketch, cartoon, anime or 3D render.";

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

const BASE_PRESETS: StudioPreset[] = [
  // ---------- Datas (§10.3) ----------
  p({ id: "aniversario", version: 2, illustration: "A joyful birthday illustration: the dog wearing a small soft party hat, sitting next to a dog-safe birthday cake with one candle, colorful balloons and confetti floating in a bright cheerful room. Warm soft lighting, festive pastel colors, charming editorial illustration style.", category: "datas", labelPt: "Aniversário", addTextOverlay: true, overlayHint: "Feliz aniversário!", prompt: [
    "A realistic, professionally produced pet photograph of a birthday party (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "A playful, joyful close-up at the dog's eye level: the dog's head and front paws fill most of the frame, with a big happy open-mouth smile and the tongue slightly out, bright eyes looking at the camera.",
    "The dog lies on a fluffy rug wearing a small pink party hat covered in colorful pom-poms, tilted a little to one side.",
    "In the foreground, big and right next to the dog's paws, a dog-safe birthday cake with thick creamy frosting, rainbow sprinkles, bone-shaped biscuits around it, a pink ribbon and one lit striped candle.",
    "Behind: lots of vivid pink, yellow, lilac and turquoise polka-dot balloons, wrapped gift boxes with shiny bows, confetti flying in the air and scattered on the rug, and twinkling golden bokeh lights.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "natal", version: 2, illustration: "A cozy Christmas scene: the dog resting on a soft knitted blanket beside a decorated Christmas tree with warm glowing fairy lights and wrapped presents. Gentle warm light, red, green and gold tones, storybook illustration style.", category: "datas", labelPt: "Natal acolhedor", addTextOverlay: true, overlayHint: "Feliz Natal!", prompt: [
    "A realistic, professionally produced pet photograph of a cozy Christmas scene (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "A joyful close-up at the dog's eye level: the dog fills most of the frame with a big happy open-mouth smile and the tongue slightly out, bright eyes looking at the camera.",
    "The dog lies on a soft red and white knitted blanket in front of a decorated Christmas tree, with wrapped presents with red and gold ribbons around it and shiny red and gold ornaments nearby.",
    "Behind: glowing warm fairy lights and twinkling golden bokeh, a cozy living room softly out of focus. Rich red, green and gold tones.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "halloween", version: 2, illustration: "A cute, not scary Halloween scene: the dog sitting among carved smiling pumpkins, autumn leaves and paper bats, with a tiny soft witch hat or a comfortable orange bandana. Playful purple and orange tones, friendly children's book illustration style.", category: "datas", labelPt: "Halloween divertido", addTextOverlay: true, overlayHint: "Feliz Halloween!", prompt: [
    "A realistic, professionally produced pet photograph of a cute, fun, not scary Halloween scene (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "A joyful close-up at the dog's eye level: the dog fills most of the frame with a big happy open-mouth smile and the tongue slightly out, bright eyes looking at the camera.",
    "The dog wears a small soft purple witch hat and a comfortable orange bandana with little pumpkin prints, lying among glowing carved smiling jack-o'-lanterns, colorful autumn leaves and straw.",
    "Behind: paper bats, warm string lights and purple and orange bokeh, softly out of focus. Playful orange, purple and gold tones.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "dia-dos-animais", version: 2, illustration: "A sunny celebration in a green park: the dog surrounded by flowers and gentle sunlight, with soft bokeh and small floating paw-print shapes in the sky. Joyful, warm, hopeful mood, soft illustration style.", category: "datas", labelPt: "Dia dos Animais (4/10)", addTextOverlay: true, overlayHint: "Feliz Dia dos Animais!", prompt: [
    "A realistic, professionally produced pet photograph of a sunny celebration in a green park (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "A joyful close-up at the dog's eye level: the dog fills most of the frame with a big happy open-mouth smile and the tongue slightly out, bright eyes looking at the camera.",
    "The dog lies on lush green grass surrounded by colorful flowers (pink, yellow and purple) in golden afternoon sunlight with a gentle sun flare through the trees.",
    "Behind: trees and a bright blue sky softly out of focus, with a few small white paw-print shaped bokeh lights. Fresh, joyful, hopeful mood.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "festa-junina", version: 2, illustration: "A Brazilian Festa Junina scene: the dog wearing a small checkered (plaid) bandana, colorful paper flag garlands (bandeirinhas) overhead, a warm bonfire glow at a safe distance in the background and a straw hat resting beside it. Cozy evening light, festive and rustic illustration style.", category: "datas", labelPt: "Festa Junina", addTextOverlay: true, overlayHint: "Arraiá!", prompt: [
    "A realistic, professionally produced pet photograph of a Brazilian Festa Junina (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "A joyful close-up at the dog's eye level: the dog fills most of the frame with a big happy open-mouth smile and the tongue slightly out, bright eyes looking at the camera.",
    "The dog wears a small red and white checkered (plaid) bandana and lies on straw next to a straw hat and a red checkered cloth, with colorful paper flag garlands (bandeirinhas) overhead.",
    "Behind: a warm bonfire glowing at a safe distance, sunflowers, rustic wood and warm string lights softly out of focus. Cozy warm evening light, festive rustic mood.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "pascoa", version: 2, illustration: "A gentle spring scene: the dog in a meadow with pastel decorated eggs in a basket (eggs are not being eaten) and soft spring flowers. Pastel colors, light and airy illustration style.", category: "datas", labelPt: "Páscoa", addTextOverlay: true, overlayHint: "Feliz Páscoa!", prompt: [
    "A realistic, professionally produced pet photograph of a gentle spring Easter scene (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "A joyful close-up at the dog's eye level: the dog fills most of the frame with a big happy open-mouth smile and the tongue slightly out, bright eyes looking at the camera.",
    "The dog lies in a flowering meadow next to a wicker basket of pastel decorated Easter eggs (the eggs are not being eaten), with daisies, little pink and lilac flowers and a few more pastel eggs in the grass.",
    "Behind: soft spring blossoms and a bright, airy pastel background softly out of focus. Light, fresh pastel pink, lilac, mint and yellow tones.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "ano-novo", version: 2, illustration: "A New Year's night celebration: the dog wearing a small shiny party bow, sitting by a window with colorful fireworks far away in the night sky and soft golden sparkles. The dog looks calm and safe indoors. Elegant night colors, glowing illustration style.", category: "datas", labelPt: "Ano Novo", addTextOverlay: true, overlayHint: "Feliz Ano Novo!", prompt: [
    "A realistic, professionally produced pet photograph of a New Year's Eve celebration (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "A joyful close-up at the dog's eye level: the dog fills most of the frame with a big happy open-mouth smile and the tongue slightly out, bright eyes looking at the camera.",
    "The dog wears a small shiny gold party hat and lies calm and safe indoors on a soft cream blanket by a large window, with gold sparkles, glowing candles and a few gold ornaments around.",
    "Through the window: colorful fireworks far away over a city skyline at night, softly out of focus. Elegant deep blue night with warm gold highlights; the dog looks relaxed and safe.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "dia-das-maes-pet", category: "datas", labelPt: "Romântico", addTextOverlay: true, overlayHint: "Amor da minha vida", prompt: "A tender portrait of the dog holding a small bouquet of flowers in a soft pastel setting with a heart-shaped soft-focus background. Loving, warm mood, gentle watercolor-like illustration style." }),
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
  p({ id: "astronauta", version: 2, illustration: "The dog as a cute astronaut floating in space wearing an open-face spacesuit (no helmet glass over the face), stars, a small planet and a friendly rocket in the background. Whimsical illustration style.", category: "fantasias", labelPt: "Astronauta", prompt: [
    "A realistic, professionally produced pet photograph: the dog as a cute astronaut floating in outer space (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "The dog wears a white and orange open-face spacesuit with small round mission patches (no flags, no real agency logos, no helmet glass over the face), its head fully visible and happy with the mouth open, paws reaching forward as if floating.",
    "Behind: a vivid purple and blue galaxy full of stars, a big blue planet with clouds, a small cratered moon and a friendly little red and white rocket with a glowing trail. Cinematic, colorful and magical light.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "super-heroi", version: 2, illustration: "The dog as an original superhero with a flowing cape and a simple paw emblem on the chest (no existing superhero logos or costumes), standing proudly on a rooftop at sunset. Dynamic comic illustration style.", category: "fantasias", labelPt: "Super-herói", prompt: [
    "A realistic, professionally produced pet photograph: the dog as an original superhero on a city rooftop at sunset (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "A joyful close-up at the dog's eye level: the dog fills most of the frame with a big happy open-mouth smile and the tongue slightly out, bright eyes looking at the camera.",
    "The dog wears a flowing red cape and a comfortable red vest with a simple gold paw emblem on the chest (no existing superhero logos or costumes) and stands proudly on the edge of a rooftop.",
    "Behind: a glowing orange and pink sunset sky over a city skyline with warm lights, softly out of focus; the cape blows in the wind.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "realeza", version: 2, illustration: "The dog as royalty: a small golden crown, a red velvet royal cape with white trim, sitting on an ornate throne in a grand palace hall. Rich painterly style.", category: "fantasias", labelPt: "Realeza", premium: true, credits: 2, aspect: "4:5", prompt: [
    "A realistic, professionally produced pet photograph: the dog as royalty in a grand palace (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "The dog lies regally on an ornate red velvet throne with gold carvings, wearing a small golden crown with jewels and a red velvet royal cape with white ermine trim, with a calm, proud and happy expression.",
    "Behind: a grand palace hall with red velvet curtains and warm golden light, softly out of focus. Rich red and gold tones.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "chef", version: 2, illustration: "The dog as a chef wearing a small white chef hat and apron in a cozy kitchen, next to dog-safe treats on the counter (no chocolate, grapes, onions or other foods toxic to dogs). Warm illustration style.", category: "fantasias", labelPt: "Chef", prompt: [
    "A realistic, professionally produced pet photograph: the dog as a chef in a cozy home kitchen (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "A joyful close-up at the dog's eye level: the dog fills most of the frame with a big happy open-mouth smile and the tongue slightly out, bright eyes looking at the camera.",
    "The dog wears a small white chef hat and a white apron with little paw prints and sits behind a wooden counter with bone-shaped dog biscuits, a cookie cutter and a little flour (no chocolate, grapes, onions or other foods toxic to dogs).",
    "Behind: a bright cozy kitchen with jars, plants and warm window light, softly out of focus.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "explorador", version: 2, illustration: "The dog as a jungle explorer with a small safari hat and a little backpack, in a lush green jungle with friendly parrots far in the background. Adventure storybook style.", category: "fantasias", labelPt: "Explorador", prompt: [
    "A realistic, professionally produced pet photograph: the dog as a jungle explorer (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "A joyful close-up at the dog's eye level: the dog fills most of the frame with a big happy open-mouth smile and the tongue slightly out, bright eyes looking at the camera.",
    "The dog wears a small khaki safari hat and a little canvas backpack and stands on a mossy rock in a lush green jungle.",
    "Behind: a beautiful waterfall, big tropical leaves and colorful friendly parrots far away, softly out of focus, with warm sun rays through the trees.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "detetive", version: 2, illustration: "The dog as a classic detective with a small tweed cap and a magnifying glass, on a cozy old street at night under a warm lamp light. Charming noir illustration style, not dark or scary.", category: "fantasias", labelPt: "Detetive", prompt: [
    "A realistic, professionally produced pet photograph: the dog as a classic detective on a cozy old street at night (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "The dog wears a small brown tweed deerstalker cap and a matching tweed cape, sits on wet cobblestones next to a big brass magnifying glass, with a curious, friendly and happy expression.",
    "Behind: warm glowing old street lamps and shop windows reflecting on the wet stones, softly out of focus. Warm amber and brown tones; charming, not dark or scary.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "surfista", version: 2, illustration: "The dog on a beach at sunset next to a colorful surfboard stuck in the sand (the dog is on the sand, not in the waves), wearing a flower lei. Bright tropical illustration style.", category: "fantasias", labelPt: "Surfista", prompt: [
    "A realistic, professionally produced pet photograph: the dog on a tropical beach at sunset (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "A joyful close-up at the dog's eye level: the dog fills most of the frame with a big happy open-mouth smile and the tongue slightly out, bright eyes looking at the camera.",
    "The dog wears a colorful flower lei and lies on the sand (not in the waves) next to a surfboard decorated with hibiscus flowers standing in the sand.",
    "Behind: a glowing orange and pink sunset over the sea, palm leaves and tropical flowers, softly out of focus.",
    PHOTO_STYLE,
  ].join(" ") }),
  p({ id: "futebol", version: 2, illustration: "The dog as a soccer star on a green field with a soccer ball, wearing a plain yellow and green bandana (no team crests, no brand logos, no real kits). Energetic sports illustration style.", category: "fantasias", labelPt: "Craque do futebol", prompt: [
    "A realistic, professionally produced pet photograph: the dog as a soccer star on a green field (a real photo, not an illustration).",
    "The dog is exactly the dog from the attached photo, with the same fur length and texture; never a generic example of its breed.",
    "A joyful close-up at the dog's eye level: the dog fills most of the frame with a big happy open-mouth smile and the tongue slightly out, bright eyes looking at the camera.",
    "The dog wears a plain yellow and green bandana (no team crests, no brand logos, no real kits) and runs happily on the grass with a paw on a classic black and white soccer ball.",
    "Behind: a soccer goal, green grass and a bright blue sky with white clouds, softly out of focus. Sunny, energetic mood.",
    PHOTO_STYLE,
  ].join(" ") }),
  // ---------- Formatos (§10.6) ----------
  p({ id: "figurinha", category: "formatos", labelPt: "Figurinha para WhatsApp", aspect: "1:1", aspects: ["1:1"], post: "sticker", prompt: "A cute die-cut sticker of the dog's head and shoulders in a clean cartoon style, thick white outline around the whole shape, on a plain solid flat light green background (#00FF00) for easy removal, no shadow." }),
  p({ id: "papel-de-parede", category: "formatos", labelPt: "Papel de parede", aspect: "9:16", aspects: ["9:16"], post: "wallpaper", prompt: "A calm, beautiful illustrated scene with the dog resting in a soft dreamy landscape, gentle gradient sky, plenty of simple space." }),
  p({ id: "cartao", category: "formatos", labelPt: "Cartão com mensagem", aspect: "4:5", aspects: ["4:5", "1:1"], post: "card", addTextOverlay: true, prompt: "A clean illustrated portrait of the dog with a soft solid pastel background and generous empty space at the bottom third." }),
  p({ id: "capa-album", category: "formatos", labelPt: "Capa do álbum", aspect: "4:5", aspects: ["4:5", "1:1"], post: "cover", prompt: "A warm illustrated cover-style portrait of the dog, centered, with a soft decorative frame of small paw prints and leaves around the edges." }),
];

/** Sufixo da variante ilustrada: "aniversario" (realista) → "aniversario-ilustrado". */
export const ILLUSTRATED_SUFFIX = "-ilustrado";

/** Todos os temas, incluindo as variantes ilustradas (mesmos créditos, formatos e textos do original). */
export const STUDIO_PRESETS: StudioPreset[] = [
  ...BASE_PRESETS,
  ...BASE_PRESETS.filter((x) => x.illustration).map((x) => ({ ...x, id: x.id + ILLUSTRATED_SUFFIX, version: 1, prompt: x.illustration!, illustration: undefined, variantOf: x.id })),
];

/** Temas que aparecem na vitrine (as variantes ficam atrás do seletor Realista/Ilustração). */
export const SHOWCASE_PRESETS = BASE_PRESETS;

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
export const STUDIO_DEFAULTS = { testCredits: 3, dailyPerAccount: 5, maxDailyGenerations: 50, jobTimeoutMinutes: 10 } as const;
