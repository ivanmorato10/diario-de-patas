/**
 * Emails do Diário de Patas com a identidade da marca (docs/BRAND.md): fundo verde-água, papel creme,
 * logo do Abu, botão marrom em pílula. Uma só fonte para:
 *  - os modelos do Supabase Auth (`npm run emails` grava supabase/templates/*.html), com as variáveis Go
 *    do Supabase ({{ .Token }}, {{ .ConfirmationURL }}…);
 *  - o email de conta excluída, enviado pelo próprio app (src/server/mailer.ts).
 * HTML de email: tabelas e estilos inline, sem CSS externo nem fontes obrigatórias.
 * Idiomas: os textos ficam em messages/<idioma>.json → emails.*. Os emails do app vão no idioma de quem recebe;
 * os modelos do Supabase trazem as duas versões e escolhem pelo user_metadata.locale ({{ .Data.locale }}).
 */
import { createTranslator } from "next-intl";
import { MESSAGES } from "@/i18n/messages";
import { DEFAULT_LOCALE, type AppLocale } from "@/i18n/locale";

export const SITE_URL = "https://diario-de-patas.vercel.app";
export const EMAIL_LOGO_URL = `${SITE_URL}/brand/email-logo.png`;
export const SUPPORT_EMAIL = "diariodepatas.app@gmail.com";

const C = { brown: "#3D2D1E", soft: "#6B5A4A", teal: "#63B4AD", tealLight: "#9ADCD2", bg: "#EAF6F3", paper: "#FFF8EC", link: "#226760", peach: "#FFD9BF", border: "#CFE3DE" };
const FONT = `'Baloo 2', 'Arial Rounded MT Bold', 'Trebuchet MS', Arial, sans-serif`;
const BODY_FONT = `'Nunito', 'Segoe UI', Arial, Helvetica, sans-serif`;

interface Layout {
  /** Texto de prévia (aparece ao lado do assunto na caixa de entrada). */
  preheader: string;
  title: string;
  /** Parágrafos (HTML simples). */
  paragraphs: string[];
  code?: string;
  cta?: { label: string; href: string };
  /** Destaque grande logo abaixo do título (ex.: "+5 créditos"). */
  hero?: string;
  /** Recibo: linhas rótulo/valor numa caixa. */
  details?: [string, string][];
  /** Nota pequena embaixo (segurança, validade). */
  note?: string;
  /** Assinatura do bilhete. */
  signature?: string;
}

const p = (html: string) => `<p style="margin:0 0 14px;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:${C.brown};">${html}</p>`;

function codeBox(code: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:6px auto 18px;">
<tr><td style="background:#ffffff;border:2px dashed ${C.teal};border-radius:16px;padding:14px 26px;text-align:center;">
<div style="font-family:${BODY_FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${C.soft};margin-bottom:4px;">${label}</div>
<div style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:8px;color:${C.brown};">${code}</div>
</td></tr></table>`;
}

function button(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:4px auto 18px;">
<tr><td style="background:${C.brown};border-radius:999px;border-bottom:3px solid #1F160D;">
<a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:17px;font-weight:bold;color:${C.paper};text-decoration:none;border-radius:999px;">${label}</a>
</td></tr></table>`;
}

function heroBox(html: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 18px;">
<tr><td align="center" style="background:${C.peach};border-radius:18px;padding:18px 12px;font-family:${FONT};font-size:30px;font-weight:bold;line-height:1.2;color:${C.brown};">${html}</td></tr></table>`;
}

function detailsBox(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;background:#ffffff;border:1px solid ${C.border};border-radius:16px;">
${rows.map(([k, v], i) => `<tr><td style="padding:10px 14px;${i ? `border-top:1px dashed ${C.border};` : ""}font-family:${BODY_FONT};font-size:14px;color:${C.soft};">${k}</td><td align="right" style="padding:10px 14px;${i ? `border-top:1px dashed ${C.border};` : ""}font-family:${BODY_FONT};font-size:14px;font-weight:bold;color:${C.brown};">${v}</td></tr>`).join("\n")}
</table>`;
}

const paws = `<span style="color:${C.teal};font-size:18px;letter-spacing:6px;">🐾 🐾 🐾</span>`;

/** Tradutor dos emails; `m` aceita <strong> nos textos (HTML do email). */
function emailT(locale: AppLocale) {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "emails" });
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const m = (key: string, values: Record<string, string | number> = {}) => t.markup(key as any, { ...values, strong: (c: string) => `<strong>${c}</strong>` } as any);
  return { t: (key: string, values?: Record<string, string | number>) => t(key as any, values as any), m, sig: (key: string) => t(key as any).replace(/\n/g, "<br>") };
}

export function layout(l: Layout, locale: AppLocale = DEFAULT_LOCALE): string {
  const { t, m, sig } = emailT(locale);
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${l.title}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${l.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
<tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
  <tr><td align="center" style="padding:0 0 18px;">
    <a href="${SITE_URL}" style="text-decoration:none;"><img src="${EMAIL_LOGO_URL}" width="168" alt="Diário de Patas — Sempre Juntos" style="display:block;width:168px;max-width:60%;height:auto;border:0;border-radius:18px;"></a>
  </td></tr>
  <tr><td style="background:${C.paper};border-radius:22px;border:1px solid ${C.border};padding:28px 26px 22px;box-shadow:0 6px 18px rgba(61,45,30,0.08);">
    <h1 style="margin:0 0 14px;font-family:${FONT};font-size:25px;line-height:1.25;color:${C.brown};">${l.title}</h1>
    ${l.hero ? heroBox(l.hero) : ""}
    ${l.paragraphs.map(p).join("\n    ")}
    ${l.details ? detailsBox(l.details) : ""}
    ${l.code ? codeBox(l.code, t("yourCode")) : ""}
    ${l.cta ? button(l.cta.label, l.cta.href) : ""}
    ${l.note ? `<p style="margin:6px 0 0;padding:12px 14px;background:${C.bg};border-radius:14px;font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:${C.soft};">${l.note}</p>` : ""}
    <p style="margin:20px 0 0;font-family:${FONT};font-size:16px;color:${C.brown};">${l.signature ?? sig("signature")}</p>
  </td></tr>
  <tr><td align="center" style="padding:18px 10px 0;font-family:${BODY_FONT};font-size:12px;line-height:1.5;color:${C.soft};">
    ${paws}<br>
    Diário de Patas · Sempre Juntos<br>
    ${m("footerHelp", { email: `<a href="mailto:${SUPPORT_EMAIL}" style="color:${C.link};">${SUPPORT_EMAIL}</a>` })}<br>
    ${m("footerWhy", { app: `<a href="${SITE_URL}" style="color:${C.link};">Diário de Patas</a>` })}
  </td></tr>
</table>
</td></tr></table>
</body></html>
`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Modelos do Supabase Auth (um por tipo, para todos): as duas versões no mesmo arquivo, escolhidas pelo idioma
 * gravado nos metadados do login. Sem idioma gravado (contas antigas), português.
 * `and` para em .Data.locale vazio, sem comparar valor ausente.
 */
const BY_LOCALE = (en: string, pt: string) => `{{ if and .Data.locale (eq .Data.locale "en") }}${en}{{ else }}${pt}{{ end }}`;

type AuthKind = "template" | "notification";
const AUTH_DEFS: { name: string; kind: AuthKind; code?: boolean; cta?: string; vars?: Record<string, string> }[] = [
  { name: "confirmation", kind: "template", code: true, cta: "{{ .ConfirmationURL }}" },
  { name: "magic_link", kind: "template", code: true, cta: "{{ .ConfirmationURL }}" },
  { name: "recovery", kind: "template", code: true, cta: "{{ .ConfirmationURL }}" },
  { name: "email_change", kind: "template", code: true, cta: "{{ .ConfirmationURL }}", vars: { email: "{{ .Email }}", newEmail: "{{ .NewEmail }}" } },
  { name: "invite", kind: "template", cta: "{{ .ConfirmationURL }}" },
  { name: "reauthentication", kind: "template", code: true },
  { name: "email_changed", kind: "notification", vars: { email: "{{ .Email }}", oldEmail: "{{ .OldEmail }}" } },
  { name: "identity_linked", kind: "notification", vars: { provider: "{{ .Provider }}" } },
  { name: "identity_unlinked", kind: "notification", vars: { provider: "{{ .Provider }}" } },
];

function authEmail(name: string, def: (typeof AUTH_DEFS)[number], locale: AppLocale) {
  const { t, m } = emailT(locale);
  const k = (x: string) => `auth.${name}.${x}`;
  const has = (x: string) => (MESSAGES[locale].emails.auth as Record<string, Record<string, string>>)[name][x] !== undefined;
  const vars = def.vars ?? {};
  const paragraphs = ["p1", "p2"].filter(has).map((p) => m(k(p), vars));
  return {
    subject: t(k("subject"), vars),
    html: layout({
      preheader: t(k("preheader"), vars), title: t(k("title"), vars), paragraphs,
      ...(def.code ? { code: "{{ .Token }}" } : {}),
      ...(def.cta ? { cta: { label: t(k("cta")), href: def.cta } } : {}),
      note: m(k("note"), vars),
    }, locale),
  };
}

/** Modelos do Supabase Auth: chave = nome do modelo no config.toml. */
export const AUTH_TEMPLATES: Record<string, { subject: string; kind: AuthKind; html: string; byLocale: Record<AppLocale, { subject: string; html: string }> }> = Object.fromEntries(
  AUTH_DEFS.map((d) => {
    const pt = authEmail(d.name, d, "pt-BR"), en = authEmail(d.name, d, "en");
    return [d.name, { kind: d.kind, subject: BY_LOCALE(en.subject, pt.subject), html: BY_LOCALE(en.html, pt.html), byLocale: { "pt-BR": pt, en } }];
  }),
);

/** Enviado pelo app (não pelo Supabase) logo depois da exclusão, no idioma de quem excluiu. */
export function accountDeletedEmail(dogName: string | null, locale: AppLocale = DEFAULT_LOCALE) {
  const { t, m } = emailT(locale);
  const dog = dogName ? esc(dogName) : null;
  return {
    subject: t("deleted.subject"),
    html: layout({
      preheader: t("deleted.preheader"),
      title: t("deleted.title"),
      paragraphs: [dog ? m("deleted.thanksDog", { dog }) : t("deleted.thanks"), t("deleted.p2"), t("deleted.p3")],
      cta: { label: t("deleted.cta"), href: SITE_URL },
      note: t("deleted.note"),
      signature: emailT(locale).sig("signatureWag"),
    }, locale),
    text: t("deleted.text"),
  };
}

export interface PurchaseReceipt { dogName: string; credits: number; amount: string; paidAt: string; balance: number | null; reference: string }

/** Pagamento confirmado: festa + recibo simples, no idioma de quem comprou. Enviado uma vez por compra. */
export function purchaseConfirmedEmail(r: PurchaseReceipt, locale: AppLocale = DEFAULT_LOCALE) {
  const { t, m } = emailT(locale);
  const dog = esc(r.dogName);
  const ref = r.reference.slice(0, 8).toUpperCase();
  const rows: [string, string][] = [
    [t("receipt.rowPack"), t("receipt.credits", { count: r.credits })],
    [t("receipt.rowPaid"), r.amount],
    [t("receipt.rowMethod"), "Pix · Mercado Pago"],
    [t("receipt.rowDate"), r.paidAt],
    [t("receipt.rowDiary"), dog],
    ...(r.balance !== null ? [[t("receipt.rowBalance"), `${t("receipt.credits", { count: r.balance })} 🐾`] as [string, string]] : []),
    [t("receipt.rowRef"), `<span style="font-family:'Courier New',monospace;font-weight:normal;">${esc(ref)}</span>`],
  ];
  return {
    subject: t("receipt.subject", { count: r.credits, dog: r.dogName }),
    html: layout({
      preheader: t("receipt.preheader", { dog }),
      title: t("receipt.title", { dog }),
      hero: `+${t("receipt.credits", { count: r.credits })} 🐾`,
      paragraphs: [m("receipt.p1", { dog }), t("receipt.p2", { count: r.credits, dog })],
      details: rows,
      cta: { label: t("receipt.cta"), href: `${SITE_URL}/estudio` },
      note: t("receipt.note"),
      signature: emailT(locale).sig("signatureWag"),
    }, locale),
    text: t("receipt.text", { count: r.credits, dog: r.dogName, amount: r.amount, date: r.paidAt, balance: r.balance ?? "-", ref, url: `${SITE_URL}/estudio` }),
  };
}
