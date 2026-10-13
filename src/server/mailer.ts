/**
 * Emails que o próprio app envia (o Supabase só manda os de login). Usa o MESMO SMTP configurado no Supabase
 * (ex.: Gmail com senha de app), lido do ambiente. Sem SMTP_HOST, não envia nada e não falha.
 */
import "server-only";
import nodemailer from "nodemailer";
import { accountDeletedEmail } from "@/lib/email-templates";

function transport() {
  const host = process.env.SMTP_HOST;
  if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
}

/** Avisa que a conta foi excluída. Nunca derruba a exclusão: erros só vão para o log. */
export async function sendAccountDeleted(to: string, dogName: string | null) {
  const t = transport();
  if (!t || !to) return;
  const mail = accountDeletedEmail(dogName);
  await t
    .sendMail({ from: process.env.SMTP_FROM || `Diário de Patas <${process.env.SMTP_USER}>`, to, subject: mail.subject, html: mail.html, text: mail.text })
    .catch((e) => console.error("email de conta excluída não enviado:", e instanceof Error ? e.message : e));
}
