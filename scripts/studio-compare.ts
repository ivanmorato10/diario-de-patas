/**
 * Comparação ANTIGO × NOVO de um preset do Estúdio, com o MESMO modelo e as mesmas configurações do app.
 * Fotos de entrada: docs/abu-referencias/ e, se existir, docs/caes-teste/ (fora do git).
 * Gera studio-eval/compare-<preset>.html com: foto original · exemplo da vitrine · prompt antigo · prompt novo.
 *
 *   npx tsx scripts/studio-compare.ts --preset aniversario [--yes]
 *
 * Sem --yes só mostra o custo estimado. A chave vem do .env.local e nunca é impressa.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { STUDIO_BASE_PROMPT, STUDIO_FORMATS, STUDIO_MODELS, buildStudioPrompt, estimateCostUsd, imageSizeFor, presetById } from "@/config/studio";
import { geminiGenerator, ProviderError } from "@/server/art-generator";

/** Prompts anteriores (v1), guardados aqui só para a comparação. */
const OLD: Record<string, string> = {
  aniversario: "A joyful birthday illustration: the dog wearing a small soft party hat, sitting next to a dog-safe birthday cake with one candle, colorful balloons and confetti floating in a bright cheerful room. Warm soft lighting, festive pastel colors, charming editorial illustration style.",
};

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const presetId = args[args.indexOf("--preset") + 1] ?? "aniversario";
const preset = presetById(presetId);
if (!preset || !OLD[presetId]) { console.error(`Preset sem prompt antigo: ${presetId}`); process.exit(1); }

for (const line of existsSync(path.join(root, ".env.local")) ? readFileSync(path.join(root, ".env.local"), "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const dirs = ["docs/abu-referencias", "docs/caes-teste"].map((d) => path.join(root, d)).filter(existsSync);
const photos = dirs.flatMap((d) => readdirSync(d).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort().map((f) => path.join(d, f)));
const cost = estimateCostUsd(preset, preset.aspect);
console.log(`${preset.labelPt}: ${photos.length} fotos × 2 prompts = ${photos.length * 2} gerações · ~US$ ${(photos.length * 2 * (cost + 0.0002)).toFixed(2)}`);
if (!args.includes("--yes")) { console.log("Nada foi gerado. Repita com --yes."); process.exit(0); }
const key = process.env.ART_GENERATOR_API_KEY || process.env.GEMINI_API_KEY;
if (!key) { console.error("Falta ART_GENERATOR_API_KEY no .env.local."); process.exit(1); }
const gen = geminiGenerator(key);
const outDir = path.join(root, "studio-eval", `compare-${presetId}`);
mkdirSync(outDir, { recursive: true });

async function ask(question: string, images: { buf: Buffer; mime: string }[]): Promise<Record<string, unknown> | null> {
  const model = process.env.STUDIO_MODEL_CHECK || STUDIO_MODELS.check;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key! },
    body: JSON.stringify({ contents: [{ parts: [{ text: question }, ...images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.buf.toString("base64") } }))] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
  });
  try { return JSON.parse((await res.json()).candidates[0].content.parts[0].text); } catch { return null; }
}

interface Shot { file: string | null; ms: number; same: number | null; photo: boolean | null; error: string | null }
const rows: { photo: string; old: Shot; neu: Shot }[] = [];

(async () => {
  const example = path.join(root, "public/estudio", `${presetId}.webp`);
  if (existsSync(example)) copyFileSync(example, path.join(outDir, "exemplo.webp"));
  const prompts = { old: [STUDIO_BASE_PROMPT, OLD[presetId], STUDIO_FORMATS[preset.aspect].prompt].join("\n\n"), neu: buildStudioPrompt(preset, preset.aspect) };
  writeFileSync(path.join(outDir, "prompts.json"), JSON.stringify({ model: gen.modelFor(preset.premium), aspect: preset.aspect, imageSize: imageSizeFor(preset.aspect), ...prompts }, null, 2));
  for (const [i, f] of photos.entries()) {
    const buf = await sharp(f).rotate().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer(); // igual ao app
    writeFileSync(path.join(outDir, `original-${i + 1}.jpg`), buf);
    const row = { photo: `original-${i + 1}.jpg` } as (typeof rows)[number];
    for (const which of (args.includes("--so-novo") ? ["neu"] : ["old", "neu"]) as ("old" | "neu")[]) {
      if (which === "neu" && args.includes("--so-novo")) row.old = JSON.parse(readFileSync(path.join(outDir, "results.json"), "utf8"))[i]?.old ?? { file: `old-${i + 1}.webp`, ms: 0, same: null, photo: null, error: null };
      process.stdout.write(`foto ${i + 1} · ${which === "old" ? "antigo" : "novo"}… `);
      const started = Date.now();
      const shot: Shot = { file: null, ms: 0, same: null, photo: null, error: null };
      try {
        const out = await gen.generate({ image: buf, mime: "image/jpeg", prompt: prompts[which], aspect: preset.aspect, imageSize: imageSizeFor(preset.aspect), premium: preset.premium });
        shot.ms = Date.now() - started;
        const art = await sharp(out.image).webp({ quality: 90 }).toBuffer();
        shot.file = `${which}-${i + 1}.webp`;
        writeFileSync(path.join(outDir, shot.file), art);
        const s = await ask('Image 1 is a photo of a real dog; image 2 is a generated image. On a scale of 1 to 5, how recognizably is image 2 the SAME individual dog (coat colors and markings, ear shape, muzzle, fur length)? Answer only JSON: {"score": 1-5}', [{ buf, mime: "image/jpeg" }, { buf: art, mime: "image/webp" }]);
        shot.same = Number(s?.score) || null;
        const p = await ask('Does this image look like a real photograph (true) or like a drawing, painting, illustration or 3D render (false)? Answer only JSON: {"photo": true|false}', [{ buf: art, mime: "image/webp" }]);
        shot.photo = typeof p?.photo === "boolean" ? p.photo : null;
        console.log(`ok ${(shot.ms / 1000).toFixed(1)} s · semelhança ${shot.same ?? "?"} · foto ${shot.photo}`);
      } catch (e) {
        shot.ms = Date.now() - started;
        shot.error = e instanceof ProviderError ? e.code : String(e);
        console.log(`falhou: ${shot.error}`);
      }
      row[which] = shot;
    }
    rows.push(row);
  }
  writeFileSync(path.join(outDir, "results.json"), JSON.stringify(rows, null, 2));
  const cap = (s: Shot) => s.file ? `${(s.ms / 1000).toFixed(1)} s · semelhança ${s.same ?? "?"}/5 · ${s.photo ? "parece foto" : "parece desenho"}` : `falhou: ${s.error}`;
  const fig = (src: string | null, c: string) => `<figure>${src ? `<img src="${src}" alt="">` : "<div class=x></div>"}<figcaption>${c}</figcaption></figure>`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comparação ${preset.labelPt}</title>
<style>body{font-family:system-ui,sans-serif;background:#eaf6f3;color:#3d2d1e;margin:0;padding:16px}.row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;background:#fff;border-radius:16px;padding:10px;margin:10px 0}figure{margin:0}img{width:100%;border-radius:10px}figcaption{font-size:.8rem;color:#6b5a4a}h2{font-size:1rem;margin:0;grid-column:1/-1}.x{aspect-ratio:1;background:#eee;border-radius:10px}</style></head><body>
<h1>${preset.labelPt}: prompt antigo × novo</h1><p>Modelo ${gen.modelFor(preset.premium)} · ${preset.aspect} · ${imageSizeFor(preset.aspect)} · mesma foto de entrada (1536 px, JPEG 90). Notas automáticas são só apoio — a decisão é visual.</p>
${rows.map((r, i) => `<div class="row"><h2>Foto ${i + 1}</h2>${fig(r.photo, "original")}${fig("exemplo.webp", "exemplo da vitrine")}${fig(r.old.file, "ANTIGO · " + cap(r.old))}${fig(r.neu.file, "NOVO · " + cap(r.neu))}</div>`).join("\n")}
</body></html>`;
  writeFileSync(path.join(outDir, "index.html"), html);
  console.log(`\nPronto: ${path.join(outDir, "index.html")}`);
})();
