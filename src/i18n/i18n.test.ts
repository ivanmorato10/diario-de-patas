import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { MESSAGES } from "./messages";
import { DEFAULT_LOCALE, defaultRegion, defaultWeightUnit, localeFromAcceptLanguage, normalizeLocale, resolveLocale, type AppLocale } from "./locale";
import { formatCivilDate, formatMoney, formatMonthKey, formatWeight, fromKg, lbToKg, toKg } from "./format";
import { splitKey, textOf } from "./keys";
import { missionText } from "./catalog";
import { loose } from "./keys";
import { ALL_MISSIONS } from "@/domain/cycle";
import { COLLECTIONS, LEVELS } from "@/config/catalog";
import { DAILY_SLOTS, PERMANENT_SETS } from "@/config/cycle";
import { STUDIO_PRESETS, STUDIO_TABS, STUDIO_FORMATS } from "@/config/studio";
import { FAILURE_CODES } from "@/data/studio-client";
import { PHOTO_ISSUES } from "@/server/photo-quality";
import { CONTACT_KINDS, MED_REPEAT, VACCINE_KINDS } from "@/domain/health";
import { DOCUMENT_CATEGORIES } from "@/domain/documents";
import { ACHADINHOS, ACHADINHO_CATEGORIES } from "@/config/achadinhos";

type Tree = { [k: string]: string | Tree };
const flat = (o: Tree, p = ""): Record<string, string> =>
  Object.fromEntries(Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[p + k, v]] : Object.entries(flat(v, `${p}${k}.`)))));
const pt = flat(MESSAGES["pt-BR"] as unknown as Tree);
const en = flat(MESSAGES.en as unknown as Tree);

/** Argumentos ({dog}, {count}…) e tags (<strong>) de uma mensagem ICU, inclusive dentro de plurais. */
function argsOf(msg: string): string[] {
  const out = new Set<string>();
  const walk = (els: MessageFormatElement[]) => {
    for (const el of els) {
      if (el.type === TYPE.argument || el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) out.add(el.value);
      if (el.type === TYPE.plural || el.type === TYPE.select) { out.add(el.value); for (const o of Object.values(el.options)) walk(o.value); }
      if (el.type === TYPE.tag) { out.add(`<${el.value}>`); walk(el.children); }
    }
  };
  walk(parse(msg));
  return [...out].sort();
}

describe("arquivos de idioma", () => {
  it("as mesmas chaves (inclusive aninhadas) em pt-BR e en, sem texto vazio", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort());
    for (const [k, v] of [...Object.entries(pt), ...Object.entries(en)]) expect(v.trim().length, k).toBeGreaterThan(0);
  });
  it("os mesmos parâmetros e tags nos dois idiomas ({dog}, {count}, <strong>…)", () => {
    for (const k of Object.keys(pt)) expect(argsOf(en[k]), k).toEqual(argsOf(pt[k]));
  });
  it("toda mensagem formata nos dois idiomas com valores de exemplo (sem erro de ICU)", () => {
    for (const locale of ["pt-BR", "en"] as const) {
      const errors: string[] = [];
      const t = loose(createTranslator({ locale, messages: MESSAGES[locale], onError: (e) => errors.push(e.message) }));
      for (const [k, msg] of Object.entries(locale === "en" ? en : pt)) {
        const values: Record<string, unknown> = {};
        for (const a of argsOf(msg)) values[a.startsWith("<") ? a.slice(1, -1) : a] = a.startsWith("<") ? (c: unknown) => c : a === "count" || a === "n" || a === "days" ? 2 : "x";
        const hasTags = argsOf(msg).some((a) => a.startsWith("<"));
        const out = hasTags ? (t as unknown as { markup: (k: string, v: unknown) => string }).markup(k, values) : t(k, values as Record<string, string>);
        expect(typeof out, k).toBe("string");
      }
      expect(errors).toEqual([]);
    }
  });
  it("nenhum texto em inglês ficou em português (amostra de palavras comuns)", () => {
    const pt_words = /\b(você|não|cachorro|lembrança|patinhas|cartinha|ossinho|diário de \{dog\}|Salvar|Cancelar|Fechar)\b/i;
    const leftovers = Object.entries(en).filter(([k, v]) => pt_words.test(v) && !/Diário de Patas/.test(v.replace(pt_words, "")) && !k.startsWith("studioCatalog.presets.festa-junina"));
    expect(leftovers.map(([k]) => k)).toEqual([]);
  });
});

describe("plurais", () => {
  const t = (locale: AppLocale) => loose(createTranslator({ locale, messages: MESSAGES[locale] }));
  it("um e vários, nos dois idiomas", () => {
    expect(t("pt-BR")("today.paws", { count: 1 })).toBe("1 patinha");
    expect(t("pt-BR")("today.paws", { count: 12 })).toBe("12 patinhas");
    expect(t("en")("today.paws", { count: 1 })).toBe("1 paw");
    expect(t("en")("today.paws", { count: 12 })).toBe("12 paws");
    expect(t("en")("care.dueIn", { days: 0 })).toBe("today");
    expect(t("en")("care.dueIn", { days: 1 })).toBe("tomorrow");
    expect(t("en")("care.dueIn", { days: 10 })).toBe("in 10 days");
    expect(t("pt-BR")("care.dueAgo", { days: 2 })).toBe("há 2 dias");
    expect(t("en")("notices.photo", { count: 3, actor: "Bia", dog: "Abu" })).toBe("Bia saved 3 moments of Abu 📸");
    expect(t("pt-BR")("notices.photo", { count: 1, actor: "Bia", dog: "Abu" })).toBe("Bia guardou uma aventura de Abu 📸");
  });
});

describe("catálogo: textos completos e {dog} explícito", () => {
  const cat = (locale: AppLocale) => MESSAGES[locale].catalog as unknown as Tree;
  it("toda missão tem título, descrição e critério; alternativa em casa só onde existe", () => {
    for (const locale of ["pt-BR", "en"] as const) {
      const missions = cat(locale).missions as Tree;
      expect(Object.keys(missions).sort()).toEqual(ALL_MISSIONS.map((m) => m.id).sort());
      for (const m of ALL_MISSIONS) {
        const x = missions[m.id] as Record<string, string>;
        expect(x.title && x.description && x.criterion, `${locale} ${m.id}`).toBeTruthy();
        expect(!!x.homeAlternative, `${locale} ${m.id} homeAlternative`).toBe(!!m.homeAlternative);
      }
    }
  });
  it("sem troca genérica da palavra cachorro: D31 fala de outro cachorro e do nome certo", () => {
    const tp = loose(createTranslator({ locale: "pt-BR", messages: MESSAGES["pt-BR"] }));
    const te = loose(createTranslator({ locale: "en", messages: MESSAGES.en }));
    expect(missionText(tp, "D31", "Abu")).toMatchObject({ description: "Um encontro tranquilo com outro cachorro.", criterion: "Abu perto de outro cachorro." });
    expect(missionText(te, "D31", "Abu")).toMatchObject({ description: "A calm meetup with another dog.", criterion: "Abu near another dog." });
    // Nenhum texto do catálogo deixa "o cachorro" no lugar do nome: onde é o cachorro da pessoa, é {dog}.
    const all = flat(cat("pt-BR"));
    expect(Object.entries(all).filter(([, v]) => /\b[Oo] cachorro\b|\bseu cachorro\b/.test(v)).map(([k]) => k)).toEqual([]);
  });
  it("coleções, conjuntos, espaços e níveis", () => {
    for (const locale of ["pt-BR", "en"] as const) {
      const c = cat(locale);
      expect(Object.keys(c.collections).sort()).toEqual(COLLECTIONS.map((x) => x.id).sort());
      expect(Object.keys(c.sets).sort()).toEqual(PERMANENT_SETS.map((x) => x.id).sort());
      expect(Object.keys(c.slots).sort()).toEqual(DAILY_SLOTS.map((x) => x.id).sort());
      expect(Object.keys(c.levels)).toHaveLength(LEVELS.length);
      for (const s of PERMANENT_SETS) expect(!!(c.sets as Tree)[s.id] && !!((c.sets as Tree)[s.id] as Tree).note, s.id).toBe(!!s.note);
    }
  });
  it("Estúdio: todo tema tem nome; datas com mensagem pronta; abas, formatos, falhas e problemas da foto", () => {
    for (const locale of ["pt-BR", "en"] as const) {
      const sc = MESSAGES[locale].studioCatalog as unknown as Tree;
      const presets = sc.presets as Tree;
      for (const p of STUDIO_PRESETS.filter((x) => !x.variantOf)) {
        expect((presets[p.id] as Tree)?.label, `${locale} ${p.id}`).toBeTruthy();
        if (p.addTextOverlay && p.category === "datas") expect((presets[p.id] as Tree).hint, `${locale} ${p.id} hint`).toBeTruthy();
      }
      expect(Object.keys(sc.tabs).sort()).toEqual(STUDIO_TABS.map((x) => x.id).sort());
      expect(Object.keys(sc.formats).sort()).toEqual(Object.keys(STUDIO_FORMATS).sort());
      const st = MESSAGES[locale].studio as unknown as Tree;
      expect(Object.keys(st.failures).sort()).toEqual([...FAILURE_CODES].sort());
      expect(Object.keys(st.issues).sort()).toEqual(Object.keys(PHOTO_ISSUES).sort());
    }
  });
  it("Cuidados e Achadinhos: todo valor de lista tem nome", () => {
    for (const locale of ["pt-BR", "en"] as const) {
      const c = MESSAGES[locale].care as unknown as Tree;
      expect(Object.keys(c.vaccineKinds).sort()).toEqual([...VACCINE_KINDS].sort());
      expect(Object.keys(c.contactKinds).sort()).toEqual([...CONTACT_KINDS].sort());
      expect(Object.keys(c.repeat).sort()).toEqual(MED_REPEAT.map((r) => r || "none").sort());
      expect(Object.keys(c.docCategories).sort()).toEqual([...DOCUMENT_CATEGORIES].sort());
      const f = MESSAGES[locale].finds as unknown as Tree;
      expect(Object.keys(f.items).sort()).toEqual(ACHADINHOS.map((a) => a.id).sort());
      for (const c2 of ACHADINHO_CATEGORIES) expect((f.categories as Tree)[c2.id]).toBeTruthy();
    }
  });
});

describe("escolha do idioma: perfil → cookie → navegador → pt-BR", () => {
  it("prioridade", () => {
    expect(resolveLocale({ profile: "en", cookie: "pt-BR", acceptLanguage: "pt-BR" })).toBe("en");
    expect(resolveLocale({ profile: null, cookie: "en", acceptLanguage: "pt-BR" })).toBe("en");
    expect(resolveLocale({ profile: null, cookie: null, acceptLanguage: "en-US,en;q=0.9" })).toBe("en");
    expect(resolveLocale({})).toBe(DEFAULT_LOCALE);
    expect(DEFAULT_LOCALE).toBe("pt-BR");
  });
  it("valores inválidos são ignorados; variantes viram en ou pt-BR; não suportado vira pt-BR", () => {
    expect(resolveLocale({ profile: "fr", cookie: "xx", acceptLanguage: "de-DE" })).toBe("pt-BR");
    expect(normalizeLocale("en-GB")).toBe("en");
    expect(normalizeLocale("EN_us")).toBe("en");
    expect(normalizeLocale("pt-PT")).toBe("pt-BR");
    expect(normalizeLocale("es")).toBeNull();
    expect(localeFromAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("en;q=0.2,pt-BR;q=0.9")).toBe("pt-BR");
    expect(localeFromAcceptLanguage("de,es")).toBeNull();
  });
  it("sugestões por idioma: EUA e libras para inglês; Brasil e kg para português", () => {
    expect([defaultRegion("en"), defaultWeightUnit("en")]).toEqual(["US", "lb"]);
    expect([defaultRegion("pt-BR"), defaultWeightUnit("pt-BR")]).toEqual(["BR", "kg"]);
  });
});

describe("datas, números, peso e dinheiro", () => {
  it("data civil nunca muda de dia (formatada em UTC ao meio-dia)", () => {
    for (const d of ["2026-01-01", "2026-12-31", "2024-02-29"]) {
      expect(formatCivilDate(d, "en", "numeric").replace(/\D/g, "")).toContain(d.slice(8, 10));
      expect(formatCivilDate(d, "pt-BR", "numeric").slice(0, 2)).toBe(d.slice(8, 10));
    }
    expect(formatCivilDate("2026-10-18", "en")).toBe("October 18, 2026");
    expect(formatCivilDate("2026-10-18", "pt-BR", "short")).toBe("18 out");
    expect(formatCivilDate("2026-10-18", "en", "short")).toBe("Oct 18");
    expect(formatMonthKey("2026-10", "pt-BR")).toBe("Outubro de 2026");
    expect(formatMonthKey("2026-10", "en")).toBe("October 2026");
  });
  it("peso: banco em kg; libras só na entrada e na tela; trocar a unidade não muda o registro", () => {
    expect(lbToKg(27.6)).toBe(12.519);
    expect(fromKg(12.519, "lb").toFixed(1)).toBe("27.6");
    expect(toKg(8.4, "kg")).toBe(8.4);
    const kg = 12.5;
    expect(formatWeight(kg, "kg", "pt-BR")).toBe("12,5 kg");
    expect(formatWeight(kg, "lb", "en")).toBe("27.6 lb");
    expect(formatWeight(kg, "kg", "en")).toBe("12.5 kg");
  });
  it("moeda real da cobrança: reais continuam reais em inglês, com BRL explícito", () => {
    expect(formatMoney(700, "BRL", "pt-BR").replace(/\s/g, " ")).toBe("R$ 7,00");
    expect(formatMoney(700, "BRL", "en")).toBe("R$7.00 (BRL)");
    expect(formatMoney(700, "USD", "en")).toBe("$7.00");
  });
});

describe("região do app", () => {
  it("decide o mercado da compra e a loja dos Achadinhos (não o idioma)", async () => {
    const { marketForRegion, CREDIT_MARKETS } = await import("@/config/credits");
    const { achadinhosFor } = await import("@/config/achadinhos");
    expect(CREDIT_MARKETS[marketForRegion("BR")].currency).toBe("BRL");
    expect(CREDIT_MARKETS[marketForRegion("US")]).toMatchObject({ currency: "USD", packages: [] });
    expect(achadinhosFor("US").every((a) => a.store === "Amazon")).toBe(true);
    expect(achadinhosFor("BR").some((a) => a.region === "US")).toBe(false);
  });
});

describe("mensagens que viajam como chave", () => {
  const t = loose(createTranslator({ locale: "en", messages: MESSAGES.en }));
  it("chave com parâmetros vira texto; texto do servidor passa direto", () => {
    expect(splitKey("validation.maxChars?max=80")).toEqual({ key: "validation.maxChars", params: { max: 80 } });
    expect(textOf(t, "validation.maxChars?max=80")).toBe("Use up to 80 characters.");
    expect(textOf(t, "We couldn't save that right now. Please try again.")).toBe("We couldn't save that right now. Please try again.");
    expect(textOf(t, "errors.fullDiary?dog=Abu&max=100&email=a%40b.c")).toContain("Abu's diary has reached");
  });
});
