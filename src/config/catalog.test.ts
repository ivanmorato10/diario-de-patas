import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MISSIONS } from "./catalog";

describe("seed SQL espelha o catálogo", () => {
  it("ids, slugs, XP, coleção e pré-requisito batem", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../supabase/seed.sql"), "utf8");
    const rows = [...sql.matchAll(/\('(M\d+)','([^']+)',.*?,(\d+),'([^']+)','([^']+)',(null|'M\d+'),(true|false)\)/g)];
    expect(rows).toHaveLength(MISSIONS.length);
    for (const [, id, slug, xp, col, , pre, subj] of rows) {
      const m = MISSIONS.find((x) => x.id === id)!;
      expect({ slug, xp: Number(xp), col, pre: pre === "null" ? null : pre.replace(/'/g, ""), subj: subj === "true" })
        .toEqual({ slug: m.slug, xp: m.xp, col: m.collectionId, pre: m.prerequisiteId, subj: m.subjective });
    }
  });
});
