import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import * as demo from "./demo-repository";
import { demoRepository } from "./demo-adapter";
import { importDemo } from "./import-demo";

const img = (hash: string): demo.ProcessedImage => ({ mime: "image/webp", width: 10, height: 10, bytes: 3, hash, display: new Blob([hash]), thumb: new Blob(["t"]) });
let n = 0;

async function fixture() {
  const src = await demo.openDemoDb(`imp-src-${++n}`);
  await demo.createDiary(src, { timezone: "America/Sao_Paulo", name: "Luna", birthDate: "2022-03-15", preferences: { home: true, outdoor: true, socialDogs: false, people: true }, photo: img("perfil") });
  const album = await demo.createAlbum(src, "Viagem à praia");
  const e1 = await demo.saveEntry(src, { requestKey: crypto.randomUUID(), image: img("a"), caption: "Primeira", occurredDate: "2026-09-01", source: "free", missionId: null, albumIds: [album.id] });
  const e2 = await demo.saveEntry(src, { requestKey: crypto.randomUUID(), image: img("b"), caption: "Brinquedo", occurredDate: "2026-09-02", source: "free", missionId: null, albumIds: ["vida-em-casa"] });
  const ok = (key: string, missionId: string, entryId: string) => demo.submitMission(src, { requestKey: key, missionId, entryId, status: "approved", reasonCode: null, mode: "owner", providerVersion: null });
  await ok(crypto.randomUUID(), "M01", e1.id);
  await ok(crypto.randomUUID(), "M03", e2.id);
  const doc = await demo.addDocument(src, { title: "Carteira", category: "vaccination_card" }, { mime: "application/pdf", bytes: 10, file: new Blob(["%PDF-1.4"]), thumb: null });
  await demo.saveVaccine(src, { kind: "vaccine", name: "V10", appliedDate: "2026-09-01", nextDate: "2027-09-01", documentId: doc.id });
  await demo.addWeight(src, { date: "2026-09-01", kg: 8.2 });
  await demo.saveContact(src, { kind: "vet", name: "Dra. Ana", phone: "+55 11 4000-0000" });
  const source = { snap: await demo.loadSnapshot(src), getMedia: (id: string) => demo.getMedia(src, id), getDocumentFile: (id: string) => demo.getDocumentFile(src, id) };
  const targetDb = await demo.openDemoDb(`imp-dst-${n}`);
  return { source, targetDb, target: demoRepository(targetDb) };
}

describe("importar o diário do aparelho para a conta (MUDANCAS-V2 §8.2)", () => {
  it("traz cachorro, lembranças, álbuns, conquistas (XP pelo destino), documentos e cuidados", async () => {
    const { source, target } = await fixture();
    const r = await importDemo(source, target);
    const t = await target.loadSnapshot();
    expect(r).toMatchObject({ entries: 2, missions: 2, documents: 1, failed: 0 });
    expect(t.dog).toMatchObject({ name: "Luna", birthDate: "2022-03-15" });
    expect(t.dog?.photoMediaId).toBeTruthy();
    expect(t.entries.map((e) => e.caption).sort()).toEqual(["Brinquedo", "Primeira"]);
    expect(t.xpTotal).toBe(25); // M01 + M03, concedidos pelo destino
    expect(t.customAlbums.map((a) => a.title)).toEqual(["Viagem à praia"]);
    const praia = t.customAlbums[0].id;
    expect(t.albumEntries.filter((a) => a.albumId === praia)).toHaveLength(1);
    expect(t.health.vaccines[0].documentId).toBe(t.health.documents[0].id);
    expect([t.health.weights.length, t.health.contacts.length]).toEqual([1, 1]);
    expect(t.profile?.demoImportedAt).toBeTruthy();
  });

  it("repetir a importação não duplica nada nem soma XP de novo", async () => {
    const { source, target } = await fixture();
    await importDemo(source, target);
    const again = await importDemo(source, target);
    const t = await target.loadSnapshot();
    expect(again).toMatchObject({ documents: 0, health: 0 });
    expect(t.entries).toHaveLength(2);
    expect(t.xpTotal).toBe(25);
    expect([t.customAlbums.length, t.health.documents.length, t.health.vaccines.length, t.health.weights.length, t.health.contacts.length]).toEqual([1, 1, 1, 1, 1]);
  });
});
