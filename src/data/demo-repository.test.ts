import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import {
  openDemoDb, resetDemo, createDiary, saveEntry, submitMission, deleteEntry, loadSnapshot, type Db, type ProcessedImage,
} from "./demo-repository";

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
