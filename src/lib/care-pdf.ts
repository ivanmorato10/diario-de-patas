/**
 * Ficha de cuidados em PDF para levar ou mandar ao veterinário, com a identidade do app (mesmo estilo do
 * álbum compartilhado): papel creme, faixa verde-água, logo, foto de perfil no círculo, fontes da marca
 * (Baloo 2, Caveat e Nunito) e seções em cartões. Gerada no próprio aparelho (pdf-lib), sem enviar nada.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { HealthData } from "@/domain/health";
import { CONTACT_KINDS, MED_REPEAT, VACCINE_KINDS, latestVaccines, medNextDue, medicationActive } from "@/domain/health";

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = { brown: hex("#3d2d1e"), soft: hex("#6b5a4a"), teal: hex("#63b4ad"), deep: hex("#3f8f88"), light: hex("#9adcd2"), paper: hex("#fff8ec"), white: hex("#ffffff"), line: hex("#efe2cc"), orange: hex("#e36f34"), peach: hex("#ffd9bf"), lilac: hex("#a17ebe") };
const A4 = { w: 595.28, h: 841.89 }, M = 40, W = A4.w - 2 * M;

/** Remove emojis e caracteres fora do alfabeto latino (as fontes embutidas cobrem latim + acentos). */
export function pdfSafe(s: string) {
  return s.normalize("NFC").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[^\x0A\x20-\x7E -ÿ]/g, "").trim();
}
const br = (d: string | null | undefined) => (d ? d.split("-").reverse().join("/") : "-");

export interface CarePdfFonts { heading: ArrayBuffer; hand: ArrayBuffer; body: ArrayBuffer; bodyBold: ArrayBuffer }
export interface CarePdfInput {
  dogName: string; birthDate: string | null; today: string; health: HealthData;
  logoPng?: ArrayBuffer | null; avatarPng?: ArrayBuffer | null; fonts?: CarePdfFonts | null;
}

/** Caminho SVG de retângulo arredondado (origem no canto superior esquerdo, y para baixo). */
const rr = (w: number, h: number, r: number) => `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;

function paw(page: PDFPage, x: number, y: number, s: number, color: RGB, opacity = 1) {
  page.drawEllipse({ x, y: y - s * 0.3, xScale: s * 0.42, yScale: s * 0.35, color, opacity });
  for (const [dx, dy] of [[-0.42, 0.15], [-0.15, 0.42], [0.15, 0.42], [0.42, 0.15]]) page.drawEllipse({ x: x + dx * s, y: y + dy * s, xScale: s * 0.14, yScale: s * 0.18, color, opacity });
}

interface Line { text: string; font: PDFFont; size: number; color: RGB; indent: number; gap: number }

export async function buildCarePdf(input: CarePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(pdfSafe(`Ficha de cuidados - ${input.dogName}`));
  pdf.setCreator("Diário de Patas");
  const f = input.fonts;
  const heading = f ? await pdf.embedFont(f.heading, { subset: true }) : await pdf.embedFont(StandardFonts.HelveticaBold);
  const hand = f ? await pdf.embedFont(f.hand, { subset: true }) : await pdf.embedFont(StandardFonts.HelveticaOblique);
  const body = f ? await pdf.embedFont(f.body, { subset: true }) : await pdf.embedFont(StandardFonts.Helvetica);
  const bold = f ? await pdf.embedFont(f.bodyBold, { subset: true }) : await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo: PDFImage | null = input.logoPng ? await pdf.embedPng(input.logoPng).catch(() => null) : null;
  const avatar: PDFImage | null = input.avatarPng ? await pdf.embedPng(input.avatarPng).catch(() => null) : null;

  let page!: PDFPage;
  let y = 0;
  let pageNo = 0;

  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    pageNo++;
    page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: C.paper });
    // Faixa do topo (verde-água) com logo e marca, igual ao álbum compartilhado.
    page.drawRectangle({ x: 0, y: A4.h - 64, width: A4.w, height: 64, color: C.teal });
    if (logo) {
      page.drawCircle({ x: M + 20, y: A4.h - 32, size: 22, color: C.paper });
      page.drawImage(logo, { x: M + 4, y: A4.h - 48, width: 32, height: 32 });
    }
    page.drawText("Diário de Patas", { x: M + 52, y: A4.h - 32, size: 18, font: heading, color: C.brown });
    page.drawText("Sempre juntos", { x: M + 52, y: A4.h - 50, size: 13, font: hand, color: C.paper });
    page.drawText(pdfSafe(`Ficha de cuidados · ${input.dogName}`), { x: A4.w - M - body.widthOfTextAtSize(pdfSafe(`Ficha de cuidados · ${input.dogName}`), 9), y: A4.h - 38, size: 9, font: bold, color: C.brown });
    // Rodapé com trilha de patinhas.
    for (let i = 0; i < 6; i++) paw(page, M + 6 + i * 16, 30 + (i % 2) * 5, 6, C.light, 0.9);
    const foot = pdfSafe(`Gerado em ${br(input.today)} · página ${pageNo} · Informações anotadas pelo tutor; não substituem a avaliação do veterinário.`);
    page.drawText(foot, { x: M + 104, y: 26, size: 7.5, font: body, color: C.soft });
    y = A4.h - 88;
  };

  const wrap = (text: string, font: PDFFont, size: number, width: number) => {
    const words = pdfSafe(text).split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= width || !cur) cur = next;
      else { out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
    return out;
  };

  /** Seção em cartão branco arredondado: título com selo verde-água e patinha, linhas por dentro (quebra de página entre cartões). */
  const card = (title: string, items: { text: string; style?: "strong" | "soft" | "note"; indent?: number }[]) => {
    const PAD = 14, inner = W - 2 * PAD;
    const lines: Line[] = [];
    for (const it of items) {
      const font = it.style === "strong" ? bold : body;
      const size = it.style === "soft" || it.style === "note" ? 9.5 : 10.5;
      const color = it.style === "soft" || it.style === "note" ? C.soft : C.brown;
      const indent = it.indent ?? 0;
      wrap(it.text, font, size, inner - indent).forEach((t, i, arr) => lines.push({ text: t, font, size, color, indent, gap: i === arr.length - 1 && it.style === "soft" ? 6 : 3 }));
    }
    const titleH = 30;
    let i = 0;
    while (i < lines.length || i === 0) {
      // Quantas linhas cabem nesta página.
      const room = y - 60 - titleH - PAD * 2;
      let used = 0, n = 0;
      while (i + n < lines.length && used + lines[i + n].size + lines[i + n].gap <= room) { used += lines[i + n].size + lines[i + n].gap; n++; }
      if (n === 0 && lines.length) { newPage(); continue; }
      const h = titleH + PAD + used + PAD - 6;
      page.drawSvgPath(rr(W, h, 14), { x: M, y, color: C.white, borderColor: C.line, borderWidth: 1 });
      // Selo do título
      const tw = heading.widthOfTextAtSize(pdfSafe(title), 12);
      page.drawSvgPath(rr(tw + 40, 22, 11), { x: M + PAD, y: y - 10, color: hex("#effaf7") });
      paw(page, M + PAD + 13, y - 21, 6, C.teal);
      page.drawText(pdfSafe(title), { x: M + PAD + 26, y: y - 25, size: 12, font: heading, color: C.deep });
      let ly = y - titleH - PAD - 4;
      for (const l of lines.slice(i, i + n)) {
        page.drawText(l.text, { x: M + PAD + l.indent, y: ly, size: l.size, font: l.font, color: l.color });
        ly -= l.size + l.gap;
      }
      if (!lines.length) page.drawText("-", { x: M + PAD, y: ly, size: 10, font: body, color: C.soft });
      y -= h + 14;
      i += n;
      if (i < lines.length) newPage();
      if (!lines.length) break;
    }
  };

  newPage();

  // Cabeçalho do cachorro: foto no círculo (com aro verde-água), nome em letra de mão e dados principais.
  const h = input.health, p = h.profile;
  const heroH = 104;
  page.drawSvgPath(rr(W, heroH, 18), { x: M, y, color: C.white, borderColor: C.line, borderWidth: 1 });
  const cx = M + 58, cy = y - heroH / 2;
  page.drawCircle({ x: cx, y: cy, size: 40, color: C.teal });
  page.drawCircle({ x: cx, y: cy, size: 36, color: C.paper });
  if (avatar) page.drawImage(avatar, { x: cx - 34, y: cy - 34, width: 68, height: 68 });
  else paw(page, cx, cy + 4, 18, C.teal);
  page.drawText("Ficha de cuidados", { x: M + 112, y: y - 30, size: 11, font: bold, color: C.deep });
  page.drawText(pdfSafe(input.dogName), { x: M + 112, y: y - 62, size: 32, font: hand, color: C.brown });
  const facts = [p?.breed, p?.sex ? (p.sex === "female" ? "fêmea" : "macho") : null, input.birthDate ? `nasceu em ${br(input.birthDate)}` : null, p?.neutered !== null && p?.neutered !== undefined ? (p.neutered ? "castrado(a)" : "não castrado(a)") : null].filter(Boolean).join(" · ");
  if (facts) page.drawText(pdfSafe(facts), { x: M + 112, y: y - 82, size: 9.5, font: body, color: C.soft });
  y -= heroH + 14;

  const ident: { text: string; style?: "strong" | "soft" | "note" }[] = [];
  if (p?.microchip) ident.push({ text: `Microchip: ${p.microchip}` });
  if (p?.coat) ident.push({ text: `Pelagem: ${p.coat}` });
  if (p?.allergies) ident.push({ text: `Alergias: ${p.allergies}`, style: "strong" });
  if (p?.notes) ident.push({ text: `Observações: ${p.notes}` });
  if (ident.length) card("Saúde e identificação", ident);

  const weights = [...h.weights].sort((a, b) => b.date.localeCompare(a.date));
  card("Peso", weights.length ? weights.slice(0, 8).map((w, i) => ({ text: `${br(w.date)}   ${w.kg.toLocaleString("pt-BR")} kg${i === 0 ? "  (mais recente)" : ""}`, style: i === 0 ? "strong" as const : undefined })) : [{ text: "Nenhum peso registrado.", style: "note" }]);

  const vacs = latestVaccines(h.vaccines);
  card("Vacinas, vermífugos e antipulgas", vacs.length ? vacs.flatMap((v) => [
    { text: `${VACCINE_KINDS[v.kind]}: ${v.name}`, style: "strong" as const },
    { text: `Aplicada em ${br(v.appliedDate)}${v.clinic ? ` · ${v.clinic}` : ""}${v.nextDate ? ` · próxima dose: ${br(v.nextDate)}` : ""}`, style: "soft" as const, indent: 10 },
  ]) : [{ text: "Nenhum registro.", style: "note" }]);

  const meds = [...h.medications].sort((a, b) => Number(medicationActive(b, input.today)) - Number(medicationActive(a, input.today)));
  card("Medicamentos", meds.length ? meds.flatMap((m) => {
    const on = medicationActive(m, input.today), next = medNextDue(m);
    const rows = [
      { text: `${m.name}${on ? "  (em uso)" : ""}`, style: "strong" as const },
      { text: [m.dose && `Dose: ${m.dose}`, m.frequency, m.repeat && MED_REPEAT[m.repeat], `início ${br(m.startDate)}`, m.endDate && `fim ${br(m.endDate)}`, next && on && `próxima dose ${br(next)}`].filter(Boolean).join(" · "), style: "soft" as const, indent: 10 },
    ];
    if (m.notes) rows.push({ text: m.notes, style: "soft" as const, indent: 10 });
    return rows;
  }) : [{ text: "Nenhum medicamento registrado.", style: "note" }]);

  const visits = [...h.visits].sort((a, b) => b.date.localeCompare(a.date));
  card("Consultas", visits.length ? visits.slice(0, 10).flatMap((v) => {
    const rows = [{ text: `${br(v.date)}${v.time ? ` ${v.time}` : ""}${v.date > input.today ? "  (agendada)" : ""} · ${v.reason || "Consulta"}`, style: "strong" as const }];
    const where = [v.clinic, v.vet].filter(Boolean).join(" · ");
    if (where) rows.push({ text: where, style: "soft" as const, indent: 10 } as never);
    if (v.notes) rows.push({ text: v.notes, style: "soft" as const, indent: 10 } as never);
    return rows;
  }) : [{ text: "Nenhuma consulta registrada.", style: "note" }]);

  const docs = h.documents ?? [];
  if (docs.length) card("Documentos guardados no app", docs.slice(0, 15).map((d) => ({ text: `${d.title}${d.docDate ? ` (${br(d.docDate)})` : ""}${d.expiresOn ? ` · vence ${br(d.expiresOn)}` : ""}` })));

  card("Contatos", h.contacts.length ? h.contacts.flatMap((c) => [
    { text: `${CONTACT_KINDS[c.kind]}: ${c.name}`, style: "strong" as const },
    ...(c.phone || c.address ? [{ text: [c.phone, c.address].filter(Boolean).join(" · "), style: "soft" as const, indent: 10 }] : []),
  ]) : [{ text: "Nenhum contato registrado.", style: "note" }]);

  return pdf.save();
}
