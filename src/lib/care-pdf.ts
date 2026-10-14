/**
 * Ficha de cuidados em PDF para levar ou mandar ao veterinário. Gerada no próprio aparelho (pdf-lib),
 * a partir dos dados do diário — nada é enviado a terceiros. Funciona no modo demonstração e com conta.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { HealthData } from "@/domain/health";
import { CONTACT_KINDS, MED_REPEAT, VACCINE_KINDS, latestVaccines, medNextDue, medicationActive } from "@/domain/health";

const BROWN = rgb(0.24, 0.18, 0.12), SOFT = rgb(0.42, 0.35, 0.29), TEAL = rgb(0.39, 0.71, 0.68), PAPER = rgb(1, 0.97, 0.93), LINE = rgb(0.81, 0.89, 0.87);
const A4 = { w: 595.28, h: 841.89 }, M = 44;

/** As fontes padrão do PDF só têm o alfabeto latino: tira emojis e troca aspas tipográficas. */
export function pdfSafe(s: string) {
  return s.normalize("NFC").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[^\x0A\x20-\x7E -ÿ]/g, "").trim();
}
const br = (d: string | null | undefined) => (d ? d.split("-").reverse().join("/") : "-");

export interface CarePdfInput { dogName: string; birthDate: string | null; today: string; health: HealthData; logoPng?: ArrayBuffer | null }

export async function buildCarePdf(input: CarePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`Ficha de cuidados - ${input.dogName}`));
  pdf.setCreator("Diário de Patas");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = input.logoPng ? await pdf.embedPng(input.logoPng).catch(() => null) : null;
  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = 0;

  const header = () => {
    page.drawRectangle({ x: 0, y: A4.h - 86, width: A4.w, height: 86, color: TEAL });
    if (logo) page.drawImage(logo, { x: M, y: A4.h - 72, width: 50, height: 50 });
    page.drawText("Diário de Patas", { x: M + (logo ? 62 : 0), y: A4.h - 44, size: 20, font: bold, color: BROWN });
    page.drawText(pdfSafe(`Ficha de cuidados de ${input.dogName}`), { x: M + (logo ? 62 : 0), y: A4.h - 64, size: 12, font, color: PAPER });
    y = A4.h - 112;
  };
  const footer = (n: number) => page.drawText(pdfSafe(`Gerado em ${br(input.today)} pelo Diário de Patas · página ${n}. Informações anotadas pelo tutor; não substituem a avaliação do veterinário.`), { x: M, y: 24, size: 7.5, font, color: SOFT });
  let pageNo = 1;
  header();
  const ensure = (h: number) => {
    if (y - h < 50) {
      footer(pageNo++);
      page = pdf.addPage([A4.w, A4.h]);
      header();
    }
  };
  const wrap = (text: string, f: PDFFont, size: number, width: number) => {
    const words = pdfSafe(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) <= width || !cur) cur = next;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  };
  const para = (text: string, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number } = {}) => {
    const size = opts.size ?? 10, f = opts.f ?? font, x = M + (opts.indent ?? 0);
    for (const line of wrap(text, f, size, A4.w - M - x)) {
      ensure(size + 4);
      page.drawText(line, { x, y, size, font: f, color: opts.color ?? BROWN });
      y -= size + 4;
    }
  };
  const section = (title: string) => {
    ensure(40);
    y -= 8;
    page.drawText(pdfSafe(title), { x: M, y, size: 13, font: bold, color: BROWN });
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 1, color: LINE });
    y -= 14;
  };
  const kv = (k: string, v: string) => para(`${k}: ${v}`, {});
  const none = (t: string) => para(t, { color: SOFT });

  const h = input.health, p = h.profile;
  section("Identificação");
  kv("Nome", input.dogName);
  kv("Nascimento", input.birthDate ? br(input.birthDate) : "não informado");
  if (p) {
    if (p.breed) kv("Raça", p.breed);
    if (p.sex) kv("Sexo", p.sex === "female" ? "fêmea" : "macho");
    if (p.neutered !== null) kv("Castrado(a)", p.neutered ? "sim" : "não");
    if (p.coat) kv("Pelagem", p.coat);
    if (p.microchip) kv("Microchip", p.microchip);
    if (p.allergies) kv("Alergias", p.allergies);
    if (p.notes) kv("Observações", p.notes);
  }

  section("Peso");
  const weights = [...h.weights].sort((a, b) => b.date.localeCompare(a.date));
  if (!weights.length) none("Nenhum peso registrado.");
  for (const w of weights.slice(0, 8)) para(`${br(w.date)} - ${w.kg.toLocaleString("pt-BR")} kg`, { indent: 8 });

  section("Vacinas, vermífugos e antipulgas (dose mais recente)");
  const vacs = latestVaccines(h.vaccines);
  if (!vacs.length) none("Nenhum registro.");
  for (const v of vacs) {
    para(`${VACCINE_KINDS[v.kind]}: ${v.name}`, { f: bold, indent: 8 });
    para(`Aplicada em ${br(v.appliedDate)}${v.clinic ? ` · ${v.clinic}` : ""}${v.nextDate ? ` · próxima: ${br(v.nextDate)}` : ""}`, { indent: 16, size: 9.5, color: SOFT });
  }

  section("Medicamentos");
  const meds = h.medications;
  if (!meds.length) none("Nenhum medicamento registrado.");
  for (const m of [...meds].sort((a, b) => Number(medicationActive(b, input.today)) - Number(medicationActive(a, input.today)))) {
    const on = medicationActive(m, input.today);
    para(`${m.name}${on ? " (em uso)" : ""}`, { f: bold, indent: 8 });
    const next = medNextDue(m);
    para([m.dose && `Dose: ${m.dose}`, m.frequency, m.repeat && MED_REPEAT[m.repeat], `início ${br(m.startDate)}`, m.endDate && `fim ${br(m.endDate)}`, next && on && `próxima dose ${br(next)}`].filter(Boolean).join(" · "), { indent: 16, size: 9.5, color: SOFT });
    if (m.notes) para(m.notes, { indent: 16, size: 9.5, color: SOFT });
  }

  section("Consultas");
  const visits = [...h.visits].sort((a, b) => b.date.localeCompare(a.date));
  if (!visits.length) none("Nenhuma consulta registrada.");
  for (const v of visits.slice(0, 10)) {
    para(`${br(v.date)}${v.date > input.today ? " (agendada)" : ""} - ${v.reason || "Consulta"}`, { f: bold, indent: 8 });
    const where = [v.clinic, v.vet].filter(Boolean).join(" · ");
    if (where) para(where, { indent: 16, size: 9.5, color: SOFT });
    if (v.notes) para(v.notes, { indent: 16, size: 9.5, color: SOFT });
  }

  const docs = h.documents ?? [];
  if (docs.length) {
    section("Documentos guardados no app");
    for (const d of docs.slice(0, 15)) para(`${d.title}${d.docDate ? ` (${br(d.docDate)})` : ""}${d.expiresOn ? ` · vence ${br(d.expiresOn)}` : ""}`, { indent: 8, size: 9.5 });
  }

  section("Contatos");
  if (!h.contacts.length) none("Nenhum contato registrado.");
  for (const c of h.contacts) para(`${CONTACT_KINDS[c.kind]}: ${c.name}${c.phone ? ` · ${c.phone}` : ""}${c.address ? ` · ${c.address}` : ""}`, { indent: 8, size: 9.5 });

  footer(pageNo);
  return pdf.save();
}
