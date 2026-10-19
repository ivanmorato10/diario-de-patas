import type ptBR from "../../messages/pt-BR.json";
import type { AppLocale } from "./locale";

declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof ptBR;
  }
}
