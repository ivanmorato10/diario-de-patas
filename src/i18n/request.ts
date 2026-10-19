/**
 * Configuração do next-intl por requisição (sem prefixo de idioma na URL).
 * O cookie já espelha o perfil (o proxy o preenche a partir do perfil quando falta, e o app o corrige ao carregar).
 * Fuso: datas civis são formatadas em UTC (nunca mudam de dia); instantes recebem o fuso explicitamente.
 */
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, isLocale, resolveLocale } from "./locale";

export default getRequestConfig(async ({ locale: explicit }) => {
  const locale = isLocale(explicit)
    ? explicit
    : resolveLocale({ cookie: (await cookies()).get(LOCALE_COOKIE)?.value, acceptLanguage: (await headers()).get("accept-language") });
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default, timeZone: "UTC" };
});
