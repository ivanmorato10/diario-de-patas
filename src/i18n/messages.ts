/**
 * Os dois catálogos completos, para o servidor (avisos, emails, erros) e os testes.
 * As telas recebem só o catálogo do idioma atual, pelo NextIntlClientProvider.
 */
import ptBR from "../../messages/pt-BR.json";
import en from "../../messages/en.json";
import type { AppLocale } from "./locale";

export type Messages = typeof ptBR;
export const MESSAGES: Record<AppLocale, Messages> = { "pt-BR": ptBR, en: en as Messages };
