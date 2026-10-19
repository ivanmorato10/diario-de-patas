/**
 * Grava os modelos de email do Supabase Auth em supabase/templates/ (fonte: src/lib/email-templates.ts) e os
 * assuntos no supabase/config.toml. Cada modelo traz português e inglês, escolhidos por {{ .Data.locale }}.
 *   npm run emails             → grava os modelos
 *   npm run emails -- --preview DIR → também grava versões com valores de exemplo (pt-BR e en) para conferir no navegador
 * Para valerem no projeto na nuvem: SMTP próprio ligado e `npm run supabase:push` (docs/SUPABASE.md §5).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AUTH_TEMPLATES, accountDeletedEmail, purchaseConfirmedEmail } from "@/lib/email-templates";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "supabase/templates");
rmSync(path.join(dir, "entrar.html"), { force: true }); // substituído por magic_link.html
for (const [name, t] of Object.entries(AUTH_TEMPLATES)) writeFileSync(path.join(dir, `${name}.html`), t.html);

// Assuntos (também com as duas versões) no config.toml: a linha `subject` logo depois de cada [auth.email.*.<nome>].
const cfgPath = path.join(root, "supabase/config.toml");
let cfg = readFileSync(cfgPath, "utf8");
for (const [name, t] of Object.entries(AUTH_TEMPLATES)) {
  const re = new RegExp(`(\\[auth\\.email\\.(?:template|notification)\\.${name}\\]\\n(?:enabled = true\\n)?)subject = .*`);
  cfg = cfg.replace(re, (_m, head) => `${head}subject = ${JSON.stringify(t.subject)}`);
}
writeFileSync(cfgPath, cfg);
console.log(`${Object.keys(AUTH_TEMPLATES).length} modelos em supabase/templates/ e assuntos no config.toml`);

const i = process.argv.indexOf("--preview");
if (i > 0) {
  const out = process.argv[i + 1];
  mkdirSync(out, { recursive: true });
  const sample = (h: string) => h.replaceAll("{{ .Token }}", "482915").replaceAll("{{ .ConfirmationURL }}", "#").replaceAll("{{ .Email }}", "voce@gmail.com").replaceAll("{{ .NewEmail }}", "novo@icloud.com").replaceAll("{{ .OldEmail }}", "antigo@gmail.com").replaceAll("{{ .Provider }}", "Google");
  for (const [name, t] of Object.entries(AUTH_TEMPLATES)) for (const [loc, v] of Object.entries(t.byLocale)) writeFileSync(path.join(out, `${name}.${loc}.html`), sample(v.html));
  for (const loc of ["pt-BR", "en"] as const) {
    writeFileSync(path.join(out, `account_deleted.${loc}.html`), accountDeletedEmail("Abu", loc).html);
    writeFileSync(path.join(out, `purchase.${loc}.html`), purchaseConfirmedEmail({ dogName: "Abu", credits: 5, amount: loc === "en" ? "R$4.00 (BRL)" : "R$ 4,00", paidAt: loc === "en" ? "October 18, 2026 at 2:05 PM" : "18 de outubro de 2026 14:05", balance: 6, reference: "a1b2c3d4" }, loc).html);
  }
  console.log(`prévias em ${out}`);
}
