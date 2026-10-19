/**
 * Teste de qualidade do Estúdio (adendo §10.8). Roda os presets com as fotos do Abu em docs/abu-referencias/
 * (fora do git) usando o Gemini DE VERDADE e gera studio-eval/studio-eval.html para o Ivan aprovar.
 *
 *   npm run studio:eval -- [--presets aniversario,aquarela] [--fotos 3] [--yes]
 *
 * Sem --yes, só mostra o custo estimado e não chama a API. A chave vem do .env.local (ART_GENERATOR_API_KEY).
 */
import { MESSAGES } from "@/i18n/messages";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { STUDIO_PRESETS, STUDIO_MODELS, buildStudioPrompt, estimateCostUsd, imageSizeFor, type StudioPreset } from "@/config/studio";
import { geminiGenerator, ProviderError } from "@/server/art-generator";
import { stickerFromGreen } from "@/server/studio";

/** Nome do tema em português (os relatórios internos ficam em pt-BR). */
const presetLabel = (id: string) => (MESSAGES["pt-BR"].studioCatalog.presets as Record<string, { label: string }>)[id.replace(/-ilustrado$/, "")]?.label ?? id;

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const yes = args.includes("--yes");

// Lê a chave do .env.local sem imprimir.
for (const line of existsSync(path.join(root, ".env.local")) ? readFileSync(path.join(root, ".env.local"), "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const photosDir = path.join(root, "docs/abu-referencias");
const photos = existsSync(photosDir) ? readdirSync(photosDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort().slice(0, Number(opt("fotos") ?? 3)) : [];
const wanted = opt("presets")?.split(",").map((s) => s.trim());
const presets: StudioPreset[] = STUDIO_PRESETS.filter((p) => (wanted ? wanted.includes(p.id) : true));

const total = presets.reduce((s, p) => s + estimateCostUsd(p, p.aspect) * photos.length, 0) + presets.length * photos.length * 0.0002;
console.log(`Presets: ${presets.length} · fotos: ${photos.length} · gerações: ${presets.length * photos.length}`);
console.log(`Custo estimado: US$ ${total.toFixed(2)} (preços oficiais de 12/10/2026; inclui checagens)`);
if (!photos.length) {
  console.error(`Nenhuma foto em ${photosDir}.`);
  process.exit(1);
}
if (!yes) {
  console.log("Nada foi gerado. Para rodar de verdade, repita com --yes.");
  process.exit(0);
}
const key = process.env.ART_GENERATOR_API_KEY || process.env.GEMINI_API_KEY;
if (!key) {
  console.error("Falta ART_GENERATOR_API_KEY no .env.local.");
  process.exit(1);
}
const gen = geminiGenerator(key);
const outDir = path.join(root, "studio-eval");
mkdirSync(outDir, { recursive: true });

/** Pergunta ao modelo barato se é o mesmo cachorro (1–5). É só um apoio: quem decide é o Ivan. */
async function similarity(original: Buffer, art: Buffer): Promise<number | null> {
  const model = process.env.STUDIO_MODEL_CHECK || STUDIO_MODELS.check;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key! },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: 'Image 1 is a photo of a real dog; image 2 is an illustration. On a scale of 1 to 5, how recognizably is image 2 the SAME individual dog (coat colors and markings, ear shape, muzzle)? Answer only JSON: {"score": 1-5}' },
        { inline_data: { mime_type: "image/jpeg", data: original.toString("base64") } },
        { inline_data: { mime_type: "image/webp", data: art.toString("base64") } },
      ] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
  });
  try {
    const json = await res.json();
    return Number(JSON.parse(json.candidates[0].content.parts[0].text).score) || null;
  } catch {
    return null;
  }
}

interface Row { preset: string; label: string; photo: string; file: string | null; ms: number; costUsd: number; dog: boolean | null; text: boolean | null; score: number | null; error: string | null }
const rows: Row[] = [];
const originals: Record<string, string> = {};

(async () => {
  for (const [pi, photo] of photos.entries()) {
    const buf = await sharp(path.join(photosDir, photo)).rotate().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    const name = `original-${pi + 1}.jpg`;
    writeFileSync(path.join(outDir, name), buf);
    originals[photo] = name;
    for (const preset of presets) {
      const started = Date.now();
      const row: Row = { preset: preset.id, label: presetLabel(preset.id), photo, file: null, ms: 0, costUsd: estimateCostUsd(preset, preset.aspect), dog: null, text: null, score: null, error: null };
      process.stdout.write(`${preset.id} × foto ${pi + 1}… `);
      try {
        const out = await gen.generate({ image: buf, mime: "image/jpeg", prompt: buildStudioPrompt(preset, preset.aspect), aspect: preset.aspect, imageSize: imageSizeFor(preset.aspect), premium: preset.premium });
        let art = preset.post === "sticker" ? await stickerFromGreen(out.image) : await sharp(out.image).webp({ quality: 90 }).toBuffer();
        if (preset.post === "wallpaper") art = await sharp(out.image).resize(1080, 1920, { fit: "cover" }).webp({ quality: 90 }).toBuffer();
        row.ms = Date.now() - started;
        const file = `${preset.id}-${pi + 1}.webp`;
        writeFileSync(path.join(outDir, file), art);
        row.file = file;
        const c = await gen.check(art, "image/webp").catch(() => null);
        row.dog = c?.dog ?? null;
        row.text = c?.text ?? null;
        row.score = await similarity(buf, art).catch(() => null);
        console.log(`ok (${(row.ms / 1000).toFixed(1)} s, semelhança ${row.score ?? "?"})`);
      } catch (e) {
        row.ms = Date.now() - started;
        row.error = e instanceof ProviderError ? e.code : String(e);
        console.log(`falhou: ${row.error}`);
      }
      rows.push(row);
    }
  }

  // Resumo por preset (custo médio, tempo médio, semelhança média) → STATUS.
  const summary = presets.map((p) => {
    const r = rows.filter((x) => x.preset === p.id);
    const ok = r.filter((x) => x.file);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    return { id: p.id, label: presetLabel(p.id), premium: p.premium, credits: p.credits, ok: ok.length, total: r.length, avgCostUsd: avg(ok.map((x) => x.costUsd)), avgSeconds: avg(ok.map((x) => x.ms / 1000)), avgScore: avg(ok.map((x) => x.score ?? 0).filter(Boolean)) };
  });
  writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ date: new Date().toISOString(), models: STUDIO_MODELS, summary, rows }, null, 2));

  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const cards = presets.map((p) => {
    const s = summary.find((x) => x.id === p.id)!;
    const imgs = rows.filter((r) => r.preset === p.id).map((r) => `<figure><img src="${r.file ?? ""}" alt="" loading="lazy">${r.file ? "" : `<p class="err">${esc(r.error ?? "")}</p>`}<figcaption>${(r.ms / 1000).toFixed(1)} s · semelhança ${r.score ?? "?"}/5${r.text ? " · TEXTO!" : ""}${r.dog === false ? " · SEM CACHORRO" : ""}</figcaption></figure>`).join("");
    return `<section><header><h2>${esc(presetLabel(p.id))} <small>${p.id} v${p.version}${p.premium ? " · premium" : ""} · ${p.credits} crédito(s)</small></h2>
<p>Custo médio US$ ${s.avgCostUsd?.toFixed(3) ?? "—"} · tempo médio ${s.avgSeconds?.toFixed(1) ?? "—"} s · semelhança média ${s.avgScore?.toFixed(1) ?? "—"}/5 · ${s.ok}/${s.total} geradas</p>
<label class="ok"><input type="checkbox" data-id="${p.id}"> Aprovar — o cachorro ficou reconhecível</label></header><div class="row">${imgs}</div></section>`;
  }).join("\n");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teste de qualidade do Estúdio</title>
<style>body{font-family:system-ui,sans-serif;background:#eaf6f3;color:#3d2d1e;margin:0;padding:16px}h1{margin:0 0 4px}section{background:#fff;border-radius:16px;padding:12px;margin:12px 0}h2{margin:0;font-size:1.1rem}small{color:#6b5a4a;font-weight:400}.row{display:flex;gap:8px;overflow-x:auto}figure{margin:0;flex:none;width:200px}img{width:200px;border-radius:10px;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 50%/16px 16px}figcaption{font-size:.8rem;color:#6b5a4a}.orig img{outline:3px solid #63b4ad}.ok{display:inline-flex;gap:6px;align-items:center;font-weight:600;margin:6px 0}.err{color:#b42318}textarea{width:100%;height:110px}</style></head><body>
<h1>Teste de qualidade do Estúdio</h1><p>${new Date().toLocaleString("pt-BR")} · modelos ${esc(STUDIO_MODELS.normal)} / ${esc(STUDIO_MODELS.premium)} · ${rows.length} gerações · custo estimado US$ ${rows.filter((r) => r.file).reduce((s, r) => s + r.costUsd, 0).toFixed(2)}</p>
<section class="orig"><h2>Fotos originais</h2><div class="row">${Object.values(originals).map((f) => `<figure><img src="${f}" alt=""></figure>`).join("")}</div></section>
${cards}
<section><h2>Aprovações</h2><p>Marque os presets aprovados e copie o SQL abaixo (só os aprovados ficam ligados no lançamento).</p><textarea id="sql" readonly></textarea></section>
<script>const all=${JSON.stringify(presets.map((p) => p.id))};function upd(){const ok=new Set([...document.querySelectorAll('input[data-id]:checked')].map(i=>i.dataset.id));document.getElementById('sql').value='insert into public.studio_presets (id, enabled) values\\n'+all.map(id=>"('"+id+"', "+ok.has(id)+")").join(',\\n')+'\\non conflict (id) do update set enabled = excluded.enabled, updated_at = now();';}document.querySelectorAll('input[data-id]').forEach(i=>i.addEventListener('change',upd));upd();</script>
</body></html>`;
  writeFileSync(path.join(outDir, "studio-eval.html"), html);
  console.log(`\nPronto: ${path.join(outDir, "studio-eval.html")}`);
})();
