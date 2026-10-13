/**
 * Texto e molduras desenhados PELO APP por cima da arte (adendo §10.2/§10.6): a IA nunca escreve texto.
 * Usa a fonte da marca (Baloo 2) no canvas do navegador.
 */
import type { StudioOverlay } from "@/data/studio-client";

const BROWN = "#3d2d1e", CREAM = "#fff8ec", TEAL = "#63b4ad", ORANGE = "#e36f34", LILAC = "#a17ebe";

/** Quebra o texto em até `maxLines` linhas que caibam na largura. */
export function wrapLines(ctx: { measureText(t: string): { width: number } }, text: string, maxWidth: number, maxLines = 2): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s*\S*$/, "")}…`;
    return kept;
  }
  return lines;
}

function paw(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(x, y + s * 0.35, s * 0.42, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  for (const [dx, dy] of [[-0.42, -0.15], [-0.15, -0.42], [0.15, -0.42], [0.42, -0.15]]) {
    ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * s, s * 0.14, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  }
}

/**
 * Compõe a arte final. `card` = cartão com espaço livre embaixo (preset Cartão); senão, faixa com a mensagem.
 * Devolve um Blob JPEG/PNG pronto para mostrar e baixar.
 */
export async function composeArt(art: Blob, overlay: StudioOverlay | null, mode: "card" | "banner" | "none"): Promise<Blob> {
  if (mode === "none" || !overlay || (!overlay.name?.trim() && !overlay.message?.trim())) return art;
  const bmp = await createImageBitmap(art);
  const W = bmp.width, H = bmp.height;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  await document.fonts?.load(`700 ${Math.round(W / 12)}px "Baloo 2 Variable"`).catch(() => undefined);
  const font = (size: number, weight = 700) => `${weight} ${Math.round(size)}px "Baloo 2 Variable", "Nunito Variable", system-ui, sans-serif`;
  const message = overlay.message?.trim() ?? "";
  const name = overlay.name?.trim() ?? "";
  const frame = overlay.frame ?? "simples";

  if (mode === "card") {
    // Moldura escolhida (3 opções) e texto no terço de baixo, que o preset deixa livre.
    const b = Math.round(W * 0.035);
    ctx.lineWidth = b;
    ctx.strokeStyle = frame === "festa" ? ORANGE : frame === "patinhas" ? TEAL : CREAM;
    ctx.strokeRect(b / 2, b / 2, W - b, H - b);
    if (frame === "patinhas") for (const [x, y] of [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]]) paw(ctx, x * W, y * H, W * 0.05, BROWN);
    if (frame === "festa") for (let i = 0; i < 40; i++) {
      ctx.fillStyle = [ORANGE, TEAL, LILAC, "#ffd9bf"][i % 4];
      const t = i / 40, side = i % 4;
      const x = side < 2 ? t * W : side === 2 ? b : W - b, y = side === 0 ? b : side === 1 ? H - b : t * H;
      ctx.beginPath(); ctx.arc(x, y, W * 0.008, 0, Math.PI * 2); ctx.fill();
    }
    const top = H * 0.7;
    ctx.textAlign = "center";
    ctx.font = font(W / 11);
    const lines = wrapLines(ctx, message || name, W * 0.8, 2);
    // Painel creme por trás do texto: legível sobre qualquer arte.
    const panelH = W / 11 * lines.length + (message && name ? W / 12 : 0) + W * 0.07;
    ctx.fillStyle = "rgba(255, 248, 236, 0.9)";
    ctx.beginPath();
    ctx.roundRect(W * 0.07, top, W * 0.86, panelH, W * 0.04);
    ctx.fill();
    ctx.fillStyle = BROWN;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, top + W / 11 * (i + 1)));
    if (message && name) {
      ctx.font = font(W / 18, 600);
      ctx.fillText(name, W / 2, top + W / 11 * lines.length + W / 12);
    }
  } else {
    // Faixa creme embaixo com a mensagem e o nome, legível sobre qualquer arte.
    ctx.font = font(W / 14);
    const text = [message, name].filter(Boolean).join(" · ");
    const lines = wrapLines(ctx, text, W * 0.84, 2);
    const lineH = W / 13;
    const bandH = lineH * lines.length + W * 0.06;
    ctx.fillStyle = "rgba(255, 248, 236, 0.92)";
    ctx.fillRect(0, H - bandH, W, bandH);
    ctx.fillStyle = BROWN;
    ctx.textAlign = "center";
    lines.forEach((l, i) => ctx.fillText(l, W / 2, H - bandH + W * 0.03 + lineH * (i + 0.8)));
  }
  return new Promise((res) => canvas.toBlob((b) => res(b ?? art), "image/png"));
}
