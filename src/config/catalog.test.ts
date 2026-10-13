import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MISSIONS } from "./catalog";
import { COLLECTION_ITEMS, DAILY_MISSIONS, SPECIAL_MISSIONS } from "./cycle";

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

describe("seed SQL espelha o ciclo (§7)", () => {
  it("itens de coleção, especiais e missões do dia batem com cycle.ts", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../supabase/seed.sql"), "utf8");
    const rows = [...sql.matchAll(/\('([CSD]\d+)','([^']+)',.*?,(\d+),'([^']+)','([^']+)','(M01)',(true|false),'([a-z_]+)',(null|'[ABC]'),(true|false),(null|'[MC]\d+'),(null|'[a-z]+')\)/g)];
    const all = [...COLLECTION_ITEMS, ...SPECIAL_MISSIONS, ...DAILY_MISSIONS];
    expect(rows).toHaveLength(all.length);
    for (const [, id, slug, xp, col, ctx, , subj, kind, slot, portrait, adv, theme] of rows) {
      const m = all.find((x) => x.id === id)!;
      const un = (v: string) => (v === "null" ? null : v.replace(/'/g, ""));
      expect({ slug, xp: Number(xp), col, ctx, subj: subj === "true", kind, slot: un(slot), portrait: portrait === "true", adv: un(adv), theme: un(theme) })
        .toEqual({ slug: m.slug, xp: m.xp, col: m.collectionId, ctx: m.context, subj: m.subjective, kind: m.kind, slot: m.slot ?? null, portrait: !!m.portrait, adv: m.advancesItem ?? null, theme: m.studioTheme ?? null });
    }
  });
});

