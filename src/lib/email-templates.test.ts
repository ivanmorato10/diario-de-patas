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
  it("todo modelo tem assunto em português e HTML completo", () => {
    for (const t of Object.values(AUTH_TEMPLATES)) {
      expect(t.subject.length).toBeGreaterThan(10);
      expect(t.html).toMatch(/^<!doctype html>/);
      expect(t.html).toContain('lang="pt-BR"');
    }
  });
  it("conta excluída escapa o nome do cachorro", () => {
    const m = accountDeletedEmail('<b>Rex</b>');
    expect(m.html).toContain("&lt;b&gt;Rex&lt;/b&gt;");
    expect(m.html).not.toContain("<b>Rex</b>");
    expect(m.text).toContain("excluída");
  });
});
