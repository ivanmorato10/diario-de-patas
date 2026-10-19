import { describe, expect, it } from "vitest";
import { AUTH_TEMPLATES, EMAIL_LOGO_URL, accountDeletedEmail } from "./email-templates";

describe("emails da marca", () => {
  it("os modelos de login trazem logo, código e link do Supabase", () => {
    for (const name of ["confirmation", "magic_link", "recovery", "email_change"]) {
      const { html } = AUTH_TEMPLATES[name];
      expect(html).toContain(EMAIL_LOGO_URL);
      expect(html).toContain("{{ .Token }}");
      expect(html).toContain("{{ .ConfirmationURL }}");
    }
  });
  it("todo modelo traz as duas versões, escolhidas pelo idioma do login (user_metadata.locale)", () => {
    for (const t of Object.values(AUTH_TEMPLATES)) {
      expect(t.subject).toMatch(/^\{\{ if and \.Data\.locale \(eq \.Data\.locale "en"\) \}\}.+\{\{ else \}\}.+\{\{ end \}\}$/);
      expect(t.html.startsWith('{{ if and .Data.locale (eq .Data.locale "en") }}<!doctype html>')).toBe(true);
      expect(t.byLocale.en.html).toContain('lang="en"');
      expect(t.byLocale["pt-BR"].html).toContain('lang="pt-BR"');
      // Variáveis do Supabase intactas nas duas versões (links e códigos não quebram).
      for (const v of ["{{ .Token }}", "{{ .ConfirmationURL }}", "{{ .Email }}", "{{ .NewEmail }}", "{{ .OldEmail }}", "{{ .Provider }}"]) {
        expect(t.byLocale.en.html.includes(v)).toBe(t.byLocale["pt-BR"].html.includes(v));
      }
    }
    expect(AUTH_TEMPLATES.magic_link.byLocale.en.subject).toBe("Your code to sign in to Diário de Patas");
    expect(AUTH_TEMPLATES.email_change.byLocale.en.html).toContain("<strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>");
  });
  it("conta excluída escapa o nome do cachorro", () => {
    const m = accountDeletedEmail('<b>Rex</b>');
    expect(m.html).toContain("&lt;b&gt;Rex&lt;/b&gt;");
    expect(m.html).not.toContain("<b>Rex</b>");
    expect(m.text).toContain("excluída");
    const en = accountDeletedEmail("Rex", "en");
    expect(en.subject).toBe("Your Diário de Patas account was deleted");
    expect(en.html).toContain('lang="en"');
  });
});
