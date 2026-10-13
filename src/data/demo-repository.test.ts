import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  openDemoDb, resetDemo, createDiary, saveEntry, submitMission, deleteEntry, loadSnapshot, exportMetadata, type Db, type ProcessedImage,
  saveHealthProfile, addWeight, saveVaccine, saveVisit, saveMedication, saveContact, deleteHealthRecord,
  addDocument, updateDocument, deleteDocument, getDocumentFile, swapDaily,
  createAlbum, renameAlbum, deleteAlbum, addEntriesToAlbum,
} from "./demo-repository";
import { PERMANENT_SETS } from "@/config/cycle";
import type { ProcessedDocument } from "@/lib/document-file";
import { LIMITS } from "@/config/business";

const img = (hash = "h"): ProcessedImage => ({
  mime: "image/webp", width: 10, height: 10, bytes: 3, hash, display: new Blob(["abc"]), thumb: new Blob(["a"]),
});

let db: Db;
let n = 0;
beforeEach(async () => {
  db = await openDemoDb(`test-${++n}`);
  await createDiary(db, { timezone: "America/Sao_Paulo", name: "Luna", birthDate: null, preferences: { home: true, outdoor: true, socialDogs: true, people: true }, photo: null });
});

const entry = (key: string) => saveEntry(db, { requestKey: key, image: img(key), caption: "", occurredDate: "2026-10-12", source: "free", missionId: null, albumIds: [] });
const approve = (key: string, entryId: string, missionId = "M01") =>
  submitMission(db, { requestKey: key, missionId, entryId, status: "approved", reasonCode: "MATCH", mode: "owner", providerVersion: null });

describe("repositório demo", () => {
  it("retry de envio não duplica a lembrança", async () => {
    const a = await entry("k1");
    const b = await entry("k1");
    expect(a.id).toBe(b.id);
    expect((await loadSnapshot(db)).entries).toHaveLength(1);
  });

  it("missão aprovada concede XP uma única vez, mesmo em requisições simultâneas", async () => {
    const e1 = await entry("e1");
    const e2 = await entry("e2");
    const results = await Promise.allSettled([approve("s1", e1.id), approve("s2", e2.id), approve("s1", e1.id)]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const snap = await loadSnapshot(db);
    expect(snap.xpTotal).toBe(10);
    expect(snap.completions).toHaveLength(1);
  });

  it("resultado incerto guarda a foto sem XP", async () => {
    const e = await entry("e");
    const r = await submitMission(db, { requestKey: "s", missionId: "M01", entryId: e.id, status: "uncertain", reasonCode: "OWNER_UNSURE", mode: "owner", providerVersion: null });
    expect(r.xpAwarded).toBe(0);
    const snap = await loadSnapshot(db);
    expect(snap.xpTotal).toBe(0);
    expect(snap.entries).toHaveLength(1);
  });

  it("missão bloqueada antes do pré-requisito", async () => {
    const e = await entry("e");
    await expect(approve("s", e.id, "M03")).rejects.toMatchObject({ code: "LOCKED" });
  });

  it("sem limite diário: muitas confirmações no mesmo dia, XP ainda uma única vez", async () => {
    const e = await entry("e");
    for (let i = 0; i < 8; i++) {
      await submitMission(db, { requestKey: `u${i}`, missionId: "M01", entryId: e.id, status: "uncertain", reasonCode: "OWNER_UNSURE", mode: "owner", providerVersion: null });
    }
    await approve("a1", e.id);
    await approve("a2", e.id);
    const snap = await loadSnapshot(db);
    expect(snap.xpTotal).toBe(10);
    expect(snap.completions).toHaveLength(1);
  });

  it("migra um banco da versão 1 sem perder dados e remove o contador antigo", async () => {
    const name = `legacy-${n}`;
    const raw = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore("profile", { keyPath: "id" }).put({ id: "me", timezone: "America/Sao_Paulo", locale: "pt-BR", createdAt: "x" });
        d.createObjectStore("dogs", { keyPath: "id" }).put({ id: "d1", name: "Thor", photoMediaId: null, birthDate: null, preferences: { home: true, outdoor: true, socialDogs: false, people: true }, createdAt: "x" });
        d.createObjectStore("media", { keyPath: "id" }).createIndex("hash", "hash");
        const en = d.createObjectStore("entries", { keyPath: "id" });
        en.createIndex("requestKey", "requestKey", { unique: true });
        en.createIndex("occurredDate", "occurredDate");
        const ae = d.createObjectStore("albumEntries", { keyPath: "key" });
        ae.createIndex("albumId", "albumId");
        ae.createIndex("entryId", "entryId");
        d.createObjectStore("submissions", { keyPath: "id" }).createIndex("requestKey", "requestKey", { unique: true });
        d.createObjectStore("completions", { keyPath: "instanceKey" });
        d.createObjectStore("xp", { keyPath: "id" }).createIndex("completionKey", "completionKey", { unique: true });
        d.createObjectStore("usage", { keyPath: "key" });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    raw.close();
    const migrated = await openDemoDb(name);
    expect([...migrated.objectStoreNames]).not.toContain("usage");
    expect((await loadSnapshot(migrated)).dog?.name).toBe("Thor");
    migrated.close();
  });

  it("várias fotos de uma vez: 5 fotos criam 5 lembranças, e o retry do lote não duplica", async () => {
    const keys = ["b1", "b2", "b3", "b4", "b5"];
    await Promise.all(keys.map(entry));
    await Promise.all(keys.map(entry)); // "Guardar todas" de novo após uma falha
    expect((await loadSnapshot(db)).entries).toHaveLength(5);
  });

  it("uma lembrança livre conclui uma missão depois, sem duplicar a foto", async () => {
    const e = await entry("livre");
    const r = await approve("depois", e.id);
    expect(r.xpAwarded).toBe(10);
    const snap = await loadSnapshot(db);
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0]).toMatchObject({ id: e.id, mediaId: e.mediaId, source: "mission", missionId: "M01" });
  });

  it("uma foto não rende pontos em duas missões", async () => {
    const e = await entry("e");
    await approve("s1", e.id, "M01");
    await expect(approve("s2", e.id, "M02")).rejects.toMatchObject({ code: "PHOTO_ALREADY_USED" });
    expect((await loadSnapshot(db)).xpTotal).toBe(10);
  });

  it("arte do Estúdio não conclui missão", async () => {
    const art = await saveEntry(db, { requestKey: "art", image: img("art"), caption: "", occurredDate: "2026-10-12", source: "studio", missionId: null, albumIds: [], kind: "art" });
    await expect(approve("s", art.id)).rejects.toMatchObject({ code: "ART_NOT_ALLOWED" });
  });

  it("excluir a foto mantém a conquista e retira do álbum", async () => {
    const e = await entry("e");
    await approve("s", e.id);
    await deleteEntry(db, e.id);
    const snap = await loadSnapshot(db);
    expect(snap.entries).toHaveLength(0);
    expect(snap.albumEntries).toHaveLength(0);
    expect(snap.completions).toHaveLength(1);
    expect(snap.xpTotal).toBe(10);
  });

  it("reset apaga tudo", async () => {
    await entry("e");
    await resetDemo(db);
    const snap = await loadSnapshot(db);
    expect(snap.dog).toBeNull();
    expect(snap.entries).toHaveLength(0);
  });

  it("reset não trava com outra aba usando o mesmo banco", async () => {
    await entry("e");
    const otherTab = await openDemoDb(`test-${n}`);
    await resetDemo(db);
    expect((await loadSnapshot(otherTab)).dog).toBeNull();
    otherTab.close();
  });
});

describe("ficha de cuidados (MUDANCAS-V2 §4)", () => {
  it("cria, edita e exclui cada tipo de registro", async () => {
    await saveHealthProfile(db, { breed: "SRD", sex: "female", neutered: true, microchip: "985 000 123", allergies: "Frango" });
    await saveHealthProfile(db, { breed: "SRD", sex: "female", neutered: true, microchip: "985 000 123", allergies: "" });
    const w = await addWeight(db, { date: "2026-10-01", kg: 8.4 });
    await addWeight(db, { date: "2026-09-01", kg: 8.1 });
    const v = await saveVaccine(db, { kind: "vaccine", name: "V10", appliedDate: "2026-10-01", nextDate: "2027-10-01" });
    const v2 = await saveVaccine(db, { kind: "vaccine", name: "V10 reforço", appliedDate: "2026-10-01", nextDate: "2026-10-22" }, v.id);
    const c = await saveVisit(db, { date: "2026-10-02", clinic: "Clínica Bem-Estar", reason: "Rotina" });
    const m = await saveMedication(db, { name: "Remédio X", dose: "1 comprimido", frequency: "a cada 12 h", startDate: "2026-10-01" });
    const k = await saveContact(db, { kind: "emergency", name: "Hospital 24h", phone: "+55 11 4000-0000" });

    let h = (await loadSnapshot(db)).health;
    expect(h.profile).toMatchObject({ breed: "SRD", allergies: "" });
    expect(h.weights.map((x) => x.kg)).toEqual([8.1, 8.4]); // ordem por data para o gráfico
    expect(h.vaccines).toHaveLength(1);
    expect(h.vaccines[0]).toMatchObject({ id: v.id, name: "V10 reforço", createdAt: v.createdAt });
    expect(v2.id).toBe(v.id);
    expect([h.visits.length, h.medications.length, h.contacts.length]).toEqual([1, 1, 1]);

    await expect(saveVaccine(db, { kind: "vaccine", name: "", appliedDate: "2026-10-01" })).rejects.toMatchObject({ code: "INVALID" });
    await expect(saveVisit(db, { date: "2026-10-01" }, "nao-existe")).rejects.toMatchObject({ code: "NOT_FOUND" });

    for (const [store, id] of [["weights", w.id], ["vaccines", v.id], ["visits", c.id], ["medications", m.id], ["contacts", k.id]] as const) {
      await deleteHealthRecord(db, store, id);
    }
    h = (await loadSnapshot(db)).health;
    expect([h.weights.length, h.vaccines.length, h.visits.length, h.medications.length, h.contacts.length]).toEqual([1, 0, 0, 0, 0]);
  });

  it("persiste ao recarregar e entra na exportação", async () => {
    await saveVaccine(db, { kind: "dewormer", name: "Vermífugo", appliedDate: "2026-10-01", nextDate: "2026-10-22" });
    db.close();
    db = await openDemoDb(`test-${n}`); // nova conexão = app recarregado
    expect((await loadSnapshot(db)).health.vaccines[0]?.name).toBe("Vermífugo");
    expect((await exportMetadata(db)).health.vaccines).toHaveLength(1);
  });

  it("apagar diário remove também a ficha de cuidados", async () => {
    await saveHealthProfile(db, { breed: "SRD" });
    await addWeight(db, { date: "2026-10-01", kg: 8 });
    await saveContact(db, { kind: "vet", name: "Dra. Ana" });
    await resetDemo(db);
    const raw = await Promise.all((["healthProfile", "weights", "vaccines", "visits", "medications", "contacts"] as const).map((s) => db.count(s)));
    expect(raw).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("migra da versão 2 para a 3 sem perder o diário", async () => {
    const name = `v2-${n}`;
    // Banco como o app v2 deixava: sem os stores de cuidados, com um cachorro salvo.
    const raw = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(name, 2);
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const st of ["profile", "dogs", "media", "entries", "albumEntries", "submissions", "completions", "xp"]) d.createObjectStore(st, { keyPath: st === "completions" ? "instanceKey" : st === "albumEntries" ? "key" : "id" });
        r.transaction!.objectStore("dogs").put({ id: "d1", name: "Thor", photoMediaId: null, birthDate: null, preferences: { home: true, outdoor: true, socialDogs: false, people: true }, createdAt: "x" });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    raw.close();
    const migrated = await openDemoDb(name);
    expect([...migrated.objectStoreNames]).toEqual(expect.arrayContaining(["vaccines", "contacts", "healthProfile"]));
    expect((await loadSnapshot(migrated)).dog?.name).toBe("Thor");
    migrated.close();
  });
});

describe("documentos (MUDANCAS-V2 §5)", () => {
  const pdf = (): ProcessedDocument => ({ mime: "application/pdf", bytes: 20, file: new Blob(["%PDF-1.4 conteúdo"], { type: "application/pdf" }), thumb: null });

  it("guarda, abre, edita e exclui; excluir tira os vínculos de vacina e consulta", async () => {
    const d = await addDocument(db, { title: "Carteira", category: "vaccination_card", expiresOn: "2027-01-01" }, pdf());
    const f = await getDocumentFile(db, d.id);
    expect(await f!.file.text()).toContain("%PDF");
    await updateDocument(db, d.id, { title: "Carteira 2026", category: "vaccination_card", expiresOn: "2027-01-01" });
    const v = await saveVaccine(db, { kind: "vaccine", name: "V10", appliedDate: "2026-10-01", documentId: d.id });
    const c = await saveVisit(db, { date: "2026-10-01", documentIds: [d.id] });
    let h = (await loadSnapshot(db)).health;
    expect(h.documents[0]).toMatchObject({ title: "Carteira 2026", mime: "application/pdf" });
    await deleteDocument(db, d.id);
    h = (await loadSnapshot(db)).health;
    expect(h.documents).toHaveLength(0);
    expect(await getDocumentFile(db, d.id)).toBeUndefined();
    expect(h.vaccines.find((x) => x.id === v.id)?.documentId).toBeNull();
    expect(h.visits.find((x) => x.id === c.id)?.documentIds).toEqual([]);
  });

  it("documentos nunca aparecem no diário nem nos álbuns", async () => {
    await addDocument(db, { title: "Exame", category: "exams" }, pdf());
    const snap = await loadSnapshot(db);
    expect(snap.entries).toHaveLength(0);
    expect(snap.albumEntries).toHaveLength(0);
  });

  it("respeita o limite de documentos", async () => {
    for (let i = 0; i < LIMITS.maxDocuments; i++) await addDocument(db, { title: `Doc ${i}`, category: "other" }, pdf());
    await expect(addDocument(db, { title: "Mais um", category: "other" }, pdf())).rejects.toMatchObject({ code: "DOC_QUOTA" });
  });

  it("apagar diário remove documentos e arquivos", async () => {
    await addDocument(db, { title: "RG", category: "id_chip" }, pdf());
    await resetDemo(db);
    expect([await db.count("documents"), await db.count("documentFiles")]).toEqual([0, 0]);
  });
});

describe("ciclo contínuo de missões (MUDANCAS-V2 §7)", () => {
  afterEach(() => vi.useRealTimers());
  const setDay = (iso: string) => vi.useFakeTimers({ toFake: ["Date"], now: new Date(`${iso}T15:00:00Z`) }); // meio-dia em SP
  const daily = async (key: string, missionId: string) => {
    const e = await entry(key);
    return submitMission(db, { requestKey: `s-${key}`, missionId, entryId: e.id, status: "approved", reasonCode: "OWNER_CONFIRMED", mode: "owner", providerVersion: null });
  };

  it("o plano do dia é gravado e reabrir no mesmo dia mostra o mesmo; a troca persiste", async () => {
    setDay("2026-10-12");
    const a = (await loadSnapshot(db)).dailyPlan!;
    db.close();
    db = await openDemoDb(`test-${n}`);
    expect((await loadSnapshot(db)).dailyPlan!.slots).toEqual(a.slots);
    const swapped = await swapDaily(db, "B");
    expect(swapped.slots.B).not.toBe(a.slots.B);
    expect((await loadSnapshot(db)).dailyPlan!.slots.B).toBe(swapped.slots.B);
  });

  it("missão do dia dá XP uma vez naquele dia e de novo em outro dia sorteado; fora do plano é recusada", async () => {
    setDay("2026-10-12");
    await approve("m01", (await entry("m01")).id);
    const plan = (await loadSnapshot(db)).dailyPlan!;
    expect((await daily("d1", plan.slots.A)).xpAwarded).toBe(10);
    expect((await daily("d1b", plan.slots.A)).xpAwarded).toBe(0); // mesmo dia: pontos já contados
    const notToday = ["D01", "D02", "D03"].find((id) => !Object.values(plan.slots).includes(id))!;
    await expect(daily("fora", notToday)).rejects.toMatchObject({ code: "NOT_TODAY" });

    // Dias depois a mesma missão volta a ser sorteada e rende de novo.
    let day = "2026-10-13";
    for (let i = 0; i < 40; i++) {
      setDay(day);
      const p = (await loadSnapshot(db)).dailyPlan!;
      if (Object.values(p.slots).includes(plan.slots.A)) break;
      day = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    }
    expect((await daily("d2", plan.slots.A)).xpAwarded).toBe(10);
  });

  it("uma foto não dá pontos em duas missões, nem na mesma missão do dia em outro dia", async () => {
    setDay("2026-10-12");
    await approve("m01", (await entry("m01")).id);
    const plan = (await loadSnapshot(db)).dailyPlan!;
    const e = await entry("foto");
    await submitMission(db, { requestKey: "x1", missionId: plan.slots.A, entryId: e.id, status: "approved", reasonCode: null, mode: "owner", providerVersion: null });
    await expect(submitMission(db, { requestKey: "x2", missionId: plan.slots.B, entryId: e.id, status: "approved", reasonCode: null, mode: "owner", providerVersion: null })).rejects.toMatchObject({ code: "PHOTO_ALREADY_USED" });
  });

  it("especial só dentro da janela e uma vez por ocorrência", async () => {
    setDay("2026-10-12");
    await approve("m01", (await entry("m01")).id);
    await expect(daily("h0", "S03")).rejects.toMatchObject({ code: "OUT_OF_WINDOW" });
    setDay("2026-10-25");
    expect((await daily("h1", "S03")).xpAwarded).toBe(20);
    expect((await daily("h2", "S03")).xpAwarded).toBe(0);
  });

  it("missão do dia ligada avança o item da coleção sem XP extra", async () => {
    setDay("2026-10-12");
    await approve("m01", (await entry("m01")).id);
    // Força um plano com D17 (avança “Bolinha”, C12) trocando o espaço B até aparecer.
    let p = (await loadSnapshot(db)).dailyPlan!;
    for (let i = 0; i < 12 && p.slots.B !== "D17"; i++) p = await swapDaily(db, "B");
    expect(p.slots.B).toBe("D17");
    const r = await daily("bola", "D17");
    expect(r).toMatchObject({ xpAwarded: 10, advancedItem: "C12" });
    expect((await loadSnapshot(db)).collectionAdvances.map((a) => a.itemId)).toEqual(["C12"]);
  });

  it("completar as 6 dá a medalha e os 50 XP uma única vez, mesmo com requisições simultâneas", async () => {
    setDay("2026-10-12");
    await approve("m01", (await entry("m01")).id);
    const set = PERMANENT_SETS.find((s) => s.id === "poses-de-dormir")!;
    for (const id of set.items.slice(0, 5)) await daily(`p-${id}`, id);
    const last = set.items[5];
    const [e1, e2] = [await entry("l1"), await entry("l2")];
    const res = await Promise.all([e1, e2].map((e, i) => submitMission(db, { requestKey: `last${i}`, missionId: last, entryId: e.id, status: "approved", reasonCode: null, mode: "owner", providerVersion: null })));
    expect(res.flatMap((r) => r.medals)).toEqual(["poses-de-dormir"]);
    const snap = await loadSnapshot(db);
    expect(snap.medals).toHaveLength(1);
    const itemsXp = set.items.length * 15; // C01–C05 e M17 valem 15 cada
    expect(snap.xpTotal).toBe(10 + itemsXp + 50);
  });
});

describe("álbuns criados pela pessoa", () => {
  it("cria com o nome que quiser, renomeia e recusa nome vazio", async () => {
    const a = await createAlbum(db, "  Viagem   à praia ");
    expect(a.title).toBe("Viagem à praia");
    expect(a.id.startsWith("custom-")).toBe(true);
    expect((await renameAlbum(db, a.id, "Praia 2026")).title).toBe("Praia 2026");
    await expect(createAlbum(db, "   ")).rejects.toMatchObject({ code: "INVALID" });
    expect((await loadSnapshot(db)).customAlbums.map((x) => x.title)).toEqual(["Praia 2026"]);
  });

  it("guarda foto direto no álbum; ids inexistentes são ignorados; adicionar não duplica", async () => {
    const a = await createAlbum(db, "Primeiro ano");
    const e1 = await saveEntry(db, { requestKey: "k1", image: img("1"), caption: "", occurredDate: "2026-10-12", source: "free", missionId: null, albumIds: [a.id, "custom-nao-existe", "vida-em-casa"] });
    const e2 = await entry("k2");
    await addEntriesToAlbum(db, a.id, [e1.id, e2.id, e2.id]);
    const snap = await loadSnapshot(db);
    expect(snap.albumEntries.filter((x) => x.albumId === a.id).map((x) => x.entryId).sort()).toEqual([e1.id, e2.id].sort());
    expect(snap.albumEntries.some((x) => x.albumId === ("custom-nao-existe" as never))).toBe(false);
    expect(snap.albumEntries.filter((x) => x.entryId === e1.id)).toHaveLength(2); // o álbum e “Vida em casa”
  });

  it("excluir o álbum mantém as fotos no diário e nos outros álbuns", async () => {
    const a = await createAlbum(db, "Temporário");
    const e = await saveEntry(db, { requestKey: "k", image: img("k"), caption: "", occurredDate: "2026-10-12", source: "free", missionId: null, albumIds: [a.id, "vida-em-casa"] });
    await deleteAlbum(db, a.id);
    const snap = await loadSnapshot(db);
    expect(snap.customAlbums).toHaveLength(0);
    expect(snap.entries.map((x) => x.id)).toEqual([e.id]);
    expect(snap.albumEntries.map((x) => x.albumId)).toEqual(["vida-em-casa"]);
  });

  it("limite de álbuns e reset", async () => {
    for (let i = 0; i < LIMITS.maxCustomAlbums; i++) await createAlbum(db, `Álbum ${i}`);
    await expect(createAlbum(db, "Mais um")).rejects.toMatchObject({ code: "ALBUM_QUOTA" });
    await resetDemo(db);
    expect(await db.count("customAlbums")).toBe(0);
  });
});

