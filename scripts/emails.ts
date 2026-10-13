/**
 * Grava os modelos de email do Supabase Auth em supabase/templates/ (fonte: src/lib/email-templates.ts).
 *   npm run emails             → grava os modelos
 *   npm run emails -- --preview DIR → também grava versões com valores de exemplo para conferir no navegador
 * Para valerem no projeto na nuvem: SMTP próprio ligado e `npx supabase config push` (docs/SUPABASE.md §5).
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AUTH_TEMPLATES, accountDeletedEmail } from "@/lib/email-templates";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "supabase/templates");
rmSync(path.join(dir, "entrar.html"), { force: true }); // substituído por magic_link.html
for (const [name, t] of Object.entries(AUTH_TEMPLATES)) writeFileSync(path.join(dir, `${name}.html`), t.html);
console.log(`${Object.keys(AUTH_TEMPLATES).length} modelos em supabase/templates/`);

const i = process.argv.indexOf("--preview");
if (i > 0) {
  const out = process.argv[i + 1];
  mkdirSync(out, { recursive: true });
  const sample = (h: string) => h.replaceAll("{{ .Token }}", "482915").replaceAll("{{ .ConfirmationURL }}", "#").replaceAll("{{ .Email }}", "voce@gmail.com").replaceAll("{{ .NewEmail }}", "novo@icloud.com").replaceAll("{{ .OldEmail }}", "antigo@gmail.com").replaceAll("{{ .Provider }}", "Google");
  for (const [name, t] of Object.entries(AUTH_TEMPLATES)) writeFileSync(path.join(out, `${name}.html`), sample(t.html));
  writeFileSync(path.join(out, "account_deleted.html"), accountDeletedEmail("Abu").html);
  console.log(`prévias em ${out}`);
}
