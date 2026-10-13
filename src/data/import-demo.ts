/**
 * Importar o diário do modo demonstração para a conta (MUDANCAS-V2 §8.2): uma única vez, com
 * confirmação, sem duplicar se repetir (lembranças pela requestKey original; cuidados e documentos
 * por comparação dos campos). As fotos sobem pelo mesmo caminho dos envios normais (bytes inspecionados).
 * Não importa: histórico de missões do dia e especiais (dias que já passaram) e avanços de coleção.
 */
import type { DocumentFile } from "@/domain/documents";
import type { MediaAsset } from "@/domain/types";
import { missionById } from "@/domain/missions";
import type { Repository, Snapshot } from "./repository";

export interface DemoSource {
  snap: Snapshot;
  getMedia(id: string): Promise<MediaAsset | undefined>;
  getDocumentFile(id: string): Promise<DocumentFile | undefined>;
}

export interface ImportReport {
  entries: number;
  missions: number;
  skippedHistory: number;
  health: number;
  documents: number;
  failed: number;
}

const newUuid = () => crypto.randomUUID();

export async function importDemo(src: DemoSource, target: Repository, onProgress: (done: number, total: number) => void = () => undefined): Promise<ImportReport> {
  const s = src.snap;
  if (!s.dog) throw new Error("Nada para importar.");
  const report: ImportReport = { entries: 0, missions: 0, skippedHistory: 0, health: 0, documents: 0, failed: 0 };
  const h = s.health;
  const total = s.entries.length + h.documents.length + 1;
  let done = 0;
  const tick = () => onProgress(++done, total);

  const asImage = (m: MediaAsset) => ({ mime: m.mime, width: m.width, height: m.height, bytes: m.bytes, hash: m.hash, display: m.display, thumb: m.thumb });

  // 1. Cachorro: se a conta ainda não tem, vem do aparelho (com a foto de perfil).
  let t = await target.loadSnapshot();
  if (!t.dog) {
    const photo = s.dog.photoMediaId ? await src.getMedia(s.dog.photoMediaId) : undefined;
    await target.createDiary({ timezone: s.profile?.timezone ?? "America/Sao_Paulo", name: s.dog.name, birthDate: s.dog.birthDate, preferences: s.dog.preferences, photo: photo ? asImage(photo) : null });
    t = await target.loadSnapshot();
  }
  tick();

  // 2. Álbuns da pessoa: reaproveita pelo nome (repetir a importação não duplica).
  const albumMap = new Map<string, string>();
  for (const a of s.customAlbums) {
    const existing = t.customAlbums.find((x) => x.title === a.title);
    albumMap.set(a.id, existing ? existing.id : (await target.createAlbum(a.title)).id);
  }
  const mapAlbum = (id: string) => (id.startsWith("custom-") ? albumMap.get(id) : id);

  // 3. Lembranças, das mais antigas para as mais novas, com a chave original.
  const entryMap = new Map<string, string>();
  for (const e of [...s.entries].reverse()) {
    try {
      const media = await src.getMedia(e.mediaId);
      if (!media) throw new Error("foto ausente");
      const albumIds = s.albumEntries.filter((x) => x.entryId === e.id).map((x) => mapAlbum(x.albumId)).filter((x): x is string => !!x);
      const saved = await target.saveEntry({
        requestKey: e.requestKey, image: asImage(media), caption: e.caption, occurredDate: e.occurredDate,
        source: e.source === "studio" ? "studio" : "free", missionId: null, albumIds, kind: media.kind,
      });
      entryMap.set(e.id, saved.id);
      report.entries++;
    } catch {
      report.failed++;
    }
    tick();
  }

  // 4. Conquistas das missões únicas e itens de coleção, com a mesma foto (o servidor dá o XP uma vez).
  // Pré-requisitos primeiro (“Olá, mundo” abre as outras).
  const ordered = [...s.completions].sort((a, b) => Number(!!missionById(a.missionId)?.prerequisiteId) - Number(!!missionById(b.missionId)?.prerequisiteId));
  for (const c of ordered) {
    const m = missionById(c.missionId);
    if (!m || m.kind === "daily" || m.kind === "special") {
      report.skippedHistory++;
      continue;
    }
    const entryId = c.entryId ? entryMap.get(c.entryId) : undefined;
    if (!entryId) {
      report.skippedHistory++;
      continue;
    }
    try {
      const r = await target.submitMission({ requestKey: newUuid(), missionId: m.id, entryId, status: "approved", reasonCode: "OWNER_CONFIRMED", mode: "owner", providerVersion: null });
      if (r.submission.status === "approved") report.missions++;
    } catch {
      report.failed++;
    }
  }

  // 5. Documentos (antes de vacinas e consultas, que apontam para eles).
  t = await target.loadSnapshot();
  const docMap = new Map<string, string>();
  for (const d of h.documents) {
    try {
      const dup = t.health.documents.find((x) => x.title === d.title && x.docDate === d.docDate && x.category === d.category);
      if (dup) docMap.set(d.id, dup.id);
      else {
        const f = await src.getDocumentFile(d.id);
        if (!f) throw new Error("arquivo ausente");
        const created = await target.addDocument({ title: d.title, category: d.category, docDate: d.docDate, expiresOn: d.expiresOn, notes: d.notes }, { mime: d.mime, bytes: d.bytes, file: f.file, thumb: f.thumb });
        docMap.set(d.id, created.id);
        report.documents++;
      }
    } catch {
      report.failed++;
    }
    tick();
  }

  // 6. Ficha de cuidados, pulando o que já existe igual na conta.
  const th = t.health;
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      report.health++;
    } catch {
      report.failed++;
    }
  };
  if (h.profile && !th.profile) {
    const { dogId: _d, updatedAt: _u, ...p } = h.profile;
    await run(() => target.saveHealthProfile(p));
  }
  for (const w of h.weights) if (!th.weights.some((x) => x.date === w.date && x.kg === w.kg)) await run(() => target.addWeight({ date: w.date, kg: w.kg }));
  for (const v of h.vaccines) {
    if (th.vaccines.some((x) => x.kind === v.kind && x.name === v.name && x.appliedDate === v.appliedDate)) continue;
    await run(() => target.saveVaccine({ kind: v.kind, name: v.name, appliedDate: v.appliedDate, nextDate: v.nextDate, clinic: v.clinic, documentId: v.documentId ? docMap.get(v.documentId) ?? null : null }));
  }
  for (const v of h.visits) {
    if (th.visits.some((x) => x.date === v.date && x.reason === v.reason && x.clinic === v.clinic)) continue;
    await run(() => target.saveVisit({ date: v.date, clinic: v.clinic, vet: v.vet, reason: v.reason, notes: v.notes, nextDate: v.nextDate, documentIds: v.documentIds.map((id) => docMap.get(id)).filter((x): x is string => !!x) }));
  }
  for (const m of h.medications) {
    if (th.medications.some((x) => x.name === m.name && x.startDate === m.startDate)) continue;
    await run(() => target.saveMedication({ name: m.name, dose: m.dose, frequency: m.frequency, startDate: m.startDate, endDate: m.endDate, notes: m.notes }));
  }
  for (const c of h.contacts) {
    if (th.contacts.some((x) => x.name === c.name && x.phone === c.phone)) continue;
    await run(() => target.saveContact({ kind: c.kind, name: c.name, phone: c.phone, address: c.address, notes: c.notes }));
  }

  await target.markDemoImported();
  return report;
}
