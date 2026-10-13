/**
 * Emails do Diário de Patas com a identidade da marca (docs/BRAND.md): fundo verde-água, papel creme,
 * logo do Abu, botão marrom em pílula. Uma só fonte para:
 *  - os modelos do Supabase Auth (`npm run emails` grava supabase/templates/*.html), com as variáveis Go
 *    do Supabase ({{ .Token }}, {{ .ConfirmationURL }}…);
 *  - o email de conta excluída, enviado pelo próprio app (src/server/mailer.ts).
 * HTML de email: tabelas e estilos inline, sem CSS externo nem fontes obrigatórias.
 */

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
  /** Nota pequena embaixo (segurança, validade). */
  note?: string;
  /** Assinatura do bilhete. */
  signature?: string;
}

const p = (html: string) => `<p style="margin:0 0 14px;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:${C.brown};">${html}</p>`;

function codeBox(code: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:6px auto 18px;">
<tr><td style="background:#ffffff;border:2px dashed ${C.teal};border-radius:16px;padding:14px 26px;text-align:center;">
<div style="font-family:${BODY_FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${C.soft};margin-bottom:4px;">Seu código</div>
<div style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:8px;color:${C.brown};">${code}</div>
</td></tr></table>`;
}

function button(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:4px auto 18px;">
<tr><td style="background:${C.brown};border-radius:999px;border-bottom:3px solid #1F160D;">
<a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:17px;font-weight:bold;color:${C.paper};text-decoration:none;border-radius:999px;">${label}</a>
</td></tr></table>`;
}

const paws = `<span style="color:${C.teal};font-size:18px;letter-spacing:6px;">🐾 🐾 🐾</span>`;

export function layout(l: Layout): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${l.title}</title></head>
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
    ${l.paragraphs.map(p).join("\n    ")}
    ${l.code ? codeBox(l.code) : ""}
    ${l.cta ? button(l.cta.label, l.cta.href) : ""}
    ${l.note ? `<p style="margin:6px 0 0;padding:12px 14px;background:${C.bg};border-radius:14px;font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:${C.soft};">${l.note}</p>` : ""}
    <p style="margin:20px 0 0;font-family:${FONT};font-size:16px;color:${C.brown};">${l.signature ?? "Com carinho,<br>Abu e a equipe do Diário de Patas"}</p>
  </td></tr>
  <tr><td align="center" style="padding:18px 10px 0;font-family:${BODY_FONT};font-size:12px;line-height:1.5;color:${C.soft};">
    ${paws}<br>
    Diário de Patas · Sempre Juntos<br>
    Dúvidas? Escreva para <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.link};">${SUPPORT_EMAIL}</a><br>
    Você recebeu este email porque ele foi usado no <a href="${SITE_URL}" style="color:${C.link};">Diário de Patas</a>.
  </td></tr>
</table>
</td></tr></table>
</body></html>
`;
}

const IGNORE = "Se não foi você que pediu, pode ignorar este email — nada muda na sua conta.";

/** Modelos do Supabase Auth: chave = nome do modelo no config.toml. */
export const AUTH_TEMPLATES: Record<string, { subject: string; kind: "template" | "notification"; html: string }> = {
  confirmation: {
    kind: "template",
    subject: "Bem-vindo ao Diário de Patas! Confirme seu email 🐾",
    html: layout({
      preheader: "Falta só um passo para começar o diário do seu cachorro.",
      title: "Que bom ter você aqui!",
      paragraphs: [
        "Sua conta no <strong>Diário de Patas</strong> está quase pronta. Confirme o email para começar a guardar as histórias do seu melhor amigo.",
        "Digite o código no app ou toque no botão, <strong>neste mesmo aparelho</strong>:",
      ],
      code: "{{ .Token }}",
      cta: { label: "Criar minha conta", href: "{{ .ConfirmationURL }}" },
      note: `O código vale por 1 hora. ${IGNORE}`,
    }),
  },
  magic_link: {
    kind: "template",
    subject: "Seu código para entrar no Diário de Patas",
    html: layout({
      preheader: "Use o código ou o botão para entrar — sem senha.",
      title: "Vamos entrar?",
      paragraphs: ["O diário está esperando por vocês. Digite o código no app ou toque no botão, <strong>neste mesmo aparelho</strong>:"],
      code: "{{ .Token }}",
      cta: { label: "Entrar no Diário de Patas", href: "{{ .ConfirmationURL }}" },
      note: `O código vale por 1 hora e só funciona uma vez. ${IGNORE}`,
    }),
  },
  recovery: {
    kind: "template",
    subject: "Recuperar o acesso ao Diário de Patas",
    html: layout({
      preheader: "Esqueceu como entrar? A gente te ajuda.",
      title: "Esqueceu a senha? Tudo bem.",
      paragraphs: [
        "No Diário de Patas você não precisa decorar senha: use o código abaixo ou toque no botão para entrar de novo na sua conta, <strong>neste mesmo aparelho</strong>.",
        "Todas as fotos, álbuns e conquistas continuam lá, do jeitinho que você deixou.",
      ],
      code: "{{ .Token }}",
      cta: { label: "Entrar de novo", href: "{{ .ConfirmationURL }}" },
      note: `O código vale por 1 hora. ${IGNORE}`,
    }),
  },
  email_change: {
    kind: "template",
    subject: "Confirme seu novo email no Diário de Patas",
    html: layout({
      preheader: "Confirme a troca de email da sua conta.",
      title: "Trocar o email da conta",
      paragraphs: ["Recebemos um pedido para trocar o email da sua conta de <strong>{{ .Email }}</strong> para <strong>{{ .NewEmail }}</strong>.", "Para confirmar, use o código ou toque no botão:"],
      code: "{{ .Token }}",
      cta: { label: "Confirmar novo email", href: "{{ .ConfirmationURL }}" },
      note: `Se você não pediu essa troca, ignore este email e o email antigo continua valendo.`,
    }),
  },
  invite: {
    kind: "template",
    subject: "Você foi convidado para o Diário de Patas 🐾",
    html: layout({
      preheader: "Um convite para guardar as histórias de um cachorro especial.",
      title: "Você recebeu um convite!",
      paragraphs: ["Alguém quer que você faça parte do <strong>Diário de Patas</strong> — o álbum das pequenas coisas que fazem a vida com um cachorro valer a pena.", "Toque no botão para aceitar:"],
      cta: { label: "Aceitar o convite", href: "{{ .ConfirmationURL }}" },
      note: "Se você não esperava este convite, pode ignorar este email.",
    }),
  },
  reauthentication: {
    kind: "template",
    subject: "Seu código de confirmação do Diário de Patas",
    html: layout({
      preheader: "Confirme que é você para continuar.",
      title: "Confirme que é você",
      paragraphs: ["Para continuar uma ação importante na sua conta, digite este código no app:"],
      code: "{{ .Token }}",
      note: `O código vale por pouco tempo. ${IGNORE}`,
    }),
  },
  email_changed: {
    kind: "notification",
    subject: "O email da sua conta foi alterado",
    html: layout({
      preheader: "Aviso de segurança da sua conta.",
      title: "Email alterado",
      paragraphs: ["O email da sua conta no Diário de Patas mudou de <strong>{{ .OldEmail }}</strong> para <strong>{{ .Email }}</strong>."],
      note: "Se não foi você, responda a este email o quanto antes.",
    }),
  },
  identity_linked: {
    kind: "notification",
    subject: "Nova forma de entrar na sua conta",
    html: layout({
      preheader: "Aviso de segurança da sua conta.",
      title: "Nova forma de entrar",
      paragraphs: ["Sua conta no Diário de Patas agora também pode ser acessada com <strong>{{ .Provider }}</strong>."],
      note: "Se não foi você, responda a este email o quanto antes.",
    }),
  },
  identity_unlinked: {
    kind: "notification",
    subject: "Uma forma de entrar foi removida da sua conta",
    html: layout({
      preheader: "Aviso de segurança da sua conta.",
      title: "Forma de entrar removida",
      paragraphs: ["<strong>{{ .Provider }}</strong> não entra mais na sua conta do Diário de Patas."],
      note: "Se não foi você, responda a este email o quanto antes.",
    }),
  },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Enviado pelo app (não pelo Supabase) logo depois da exclusão. */
export function accountDeletedEmail(dogName: string | null) {
  const dog = dogName ? esc(dogName) : null;
  return {
    subject: "Sua conta no Diário de Patas foi excluída",
    html: layout({
      preheader: "Tudo foi apagado, como você pediu.",
      title: "Até logo 🐾",
      paragraphs: [
        "Como você pediu, a sua conta no Diário de Patas foi <strong>excluída</strong>: perfil, fotos, álbuns, conquistas, cuidados e documentos foram apagados, e os links compartilhados pararam de funcionar.",
        dog ? `Foi muito bom guardar as histórias de <strong>${dog}</strong> com vocês. Desejamos muitos passeios, sonecas e petiscos pela frente.` : "Foi muito bom ter vocês por aqui. Desejamos muitos passeios, sonecas e petiscos pela frente.",
        "Se um dia quiser voltar, é só criar uma conta nova — as portas (e as patas) estão abertas.",
      ],
      cta: { label: "Visitar o Diário de Patas", href: SITE_URL },
      note: "Se você não pediu a exclusão, responda a este email.",
      signature: "Com carinho e um abano de rabo,<br>Abu e a equipe do Diário de Patas",
    }),
    text: `Sua conta no Diário de Patas foi excluída, como você pediu. Perfil, fotos, álbuns, conquistas, cuidados e documentos foram apagados, e os links compartilhados pararam de funcionar.\n\nSe você não pediu a exclusão, responda a este email.\n\nCom carinho, Abu e a equipe do Diário de Patas`,
  };
}
