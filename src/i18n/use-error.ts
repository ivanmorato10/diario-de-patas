"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { DomainError } from "@/data/demo-repository";
import { textOf } from "./keys";

/**
 * Texto de um erro para a tela: mensagem do servidor (já no idioma da pessoa), chave do app
 * ("errors.x", "validation.y?max=80") ou, sem nada melhor, a chave de reserva.
 */
export function useErrorText() {
  const t = useTranslations();
  return useCallback((e: unknown, fallback: string = "errors.generic") => {
    if (typeof e === "string") return textOf(t, e);
    if (e instanceof DomainError && e.message) return textOf(t, e.message);
    return textOf(t, fallback);
  }, [t]);
}
