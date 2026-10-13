/** Modo demonstração: a interface `Repository` sobre o IndexedDB deste navegador. */
import * as demo from "./demo-repository";
import type { Repository } from "./repository";

export function demoRepository(db: demo.Db): Repository {
  return {
    mode: "demo",
    loadSnapshot: () => demo.loadSnapshot(db),
    getMediaBlob: async (id, variant) => (await demo.getMedia(db, id))?.[variant] ?? null,
    createDiary: (input) => demo.createDiary(db, input),
    updateDog: (patch) => demo.updateDog(db, patch),
    updateTimezone: (tz) => demo.updateTimezone(db, tz),
    findEntryByHash: (hash) => demo.findEntryByHash(db, hash),
    saveEntry: (input) => demo.saveEntry(db, input),
    updateEntry: (id, patch) => demo.updateEntry(db, id, patch),
    deleteEntry: (id) => demo.deleteEntry(db, id),
    submitMission: (input) => demo.submitMission(db, input),
    swapDaily: (slot) => demo.swapDaily(db, slot),
    saveHealthProfile: (input) => demo.saveHealthProfile(db, input),
    addWeight: (input) => demo.addWeight(db, input),
    saveVaccine: (input, id) => demo.saveVaccine(db, input, id),
    saveVisit: (input, id) => demo.saveVisit(db, input, id),
    saveMedication: (input, id) => demo.saveMedication(db, input, id),
    saveContact: (input, id) => demo.saveContact(db, input, id),
    deleteHealthRecord: (store, id) => demo.deleteHealthRecord(db, store, id),
    addDocument: (meta, file) => demo.addDocument(db, meta, file),
    updateDocument: (id, meta) => demo.updateDocument(db, id, meta),
    deleteDocument: (id) => demo.deleteDocument(db, id),
    getDocumentFile: async (id) => {
      const f = await demo.getDocumentFile(db, id);
      return f ? { file: f.file, thumb: f.thumb } : null;
    },
    exportMetadata: () => demo.exportMetadata(db),
    wipe: () => demo.resetDemo(db),
  };
}
