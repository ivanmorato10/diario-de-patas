/**
 * Emails que o próprio app envia (o Supabase só manda os de login). Usa o MESMO SMTP configurado no Supabase
 * (ex.: Gmail com senha de app), lido do ambiente. Sem SMTP_HOST, não envia nada e não falha.
 */
import "server-only";
import nodemailer from "nodemailer";
import { accountDeletedEmail, purchaseConfirmedEmail, type PurchaseReceipt } from "@/lib/email-templates";
import { DEFAULT_LOCALE, type AppLocale } from "@/i18n/locale";

function transport() {
  const host = process.env.SMTP_HOST;
  if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
}

/** Domínios reservados para testes (RFC 2606/6761): nunca recebem email — evita devoluções na caixa do app. */
export const isTestAddress = (to: string) => /\.(test|example|invalid|localhost)$/i.test(to.trim()) || /@example\.(com|net|org)$/i.test(to.trim());

/** Avisa que a conta foi excluída. Nunca derruba a exclusão: erros só vão para o log. */
export async function sendAccountDeleted(to: string, dogName: string | null, locale: AppLocale = DEFAULT_LOCALE) {
  const t = transport();
  if (!t || !to || isTestAddress(to)) return;
  const mail = accountDeletedEmail(dogName, locale);
  await t
    .sendMail({ from: process.env.SMTP_FROM || `Diário de Patas <${process.env.SMTP_USER}>`, to, subject: mail.subject, html: mail.html, text: mail.text })
    .catch((e) => console.error("email de conta excluída não enviado:", e instanceof Error ? e.message : e));
}

/** Comprovante de compra de créditos. "skipped" = não há como enviar (sem SMTP ou endereço de teste). */
export async function sendPurchaseConfirmed(to: string, receipt: PurchaseReceipt, locale: AppLocale = DEFAULT_LOCALE): Promise<"sent" | "skipped" | "failed"> {
  const t = transport();
  if (!t || !to || isTestAddress(to)) return "skipped";
  const mail = purchaseConfirmedEmail(receipt, locale);
  return t
    .sendMail({ from: process.env.SMTP_FROM || `Diário de Patas <${process.env.SMTP_USER}>`, to, subject: mail.subject, html: mail.html, text: mail.text })
    .then(() => "sent" as const, (e) => { console.error("email de compra não enviado:", e instanceof Error ? e.message : e); return "failed" as const; });
}
