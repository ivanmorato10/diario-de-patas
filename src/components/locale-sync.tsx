"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useStore } from "@/data/store";
import { rpc } from "@/data/real-repository";
import { localeCookie, type AppLocale, type Region, type WeightUnit } from "@/i18n/locale";

/**
 * Mantém o idioma da tela igual ao do perfil (o perfil vem antes do cookie):
 * - perfil com idioma diferente (trocado em outro aparelho): ajusta o cookie e atualiza a página, sem perder a tela;
 * - perfil ainda sem idioma (conta nova): grava o idioma em uso, para avisos e emails chegarem no idioma certo.
 */
export function LocaleSync() {
  const { snap, patchSnap } = useStore();
  const locale = useLocale();
  const router = useRouter();
  const tried = useRef<string | null>(null);
  const saved = snap?.me?.locale;
  const signedIn = !!snap?.me;
  useEffect(() => {
    if (!signedIn) return;
    if (saved && saved !== locale) {
      if (tried.current === saved) return; // cookie bloqueado: não fica atualizando sem parar
      tried.current = saved;
      document.cookie = localeCookie(saved);
      router.refresh();
    } else if (!saved) {
      patchSnap((s) => (s.me ? { ...s, me: { ...s.me, locale } } : s));
      void rpc("setPreferences", { locale }).catch(() => undefined);
    }
  }, [signedIn, saved, locale, router, patchSnap]);
  return null;
}

/**
 * Troca de preferências da pessoa. Idioma: cookie na hora (vale antes do login) e, com conta, perfil + metadados
 * do login; a página atualiza sem recarregar (formulários, envios e artes em andamento continuam).
 */
/** Salvamentos em fila: toques rápidos (kg → lb) chegam ao servidor na ordem em que a pessoa escolheu. */
let queue: Promise<unknown> = Promise.resolve();

export function useSetPreferences() {
  const { snap, patchSnap } = useStore();
  const router = useRouter();
  return async (p: { locale?: AppLocale; region?: Region; weightUnit?: WeightUnit }) => {
    if (snap?.me) patchSnap((s) => (s.me ? { ...s, me: { ...s.me, ...p } } : s));
    if (p.locale) document.cookie = localeCookie(p.locale);
    if (snap?.me) {
      const save = queue.then(() => rpc("setPreferences", p));
      queue = save.catch(() => undefined);
      await save;
    }
    if (p.locale) router.refresh();
  };
}
