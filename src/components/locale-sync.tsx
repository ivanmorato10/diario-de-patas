"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useStore } from "@/data/store";
import { rpc } from "@/data/real-repository";
import { defaultRegion, defaultWeightUnit, localeCookie, type AppLocale, type Region, type WeightUnit } from "@/i18n/locale";

type Prefs = { locale?: AppLocale; region?: Region; weightUnit?: WeightUnit };

/** Novas tentativas da gravação automática (conta nova), em ms; também tenta de novo quando a internet volta. */
const AUTO_RETRY_MS = [3_000, 15_000, 60_000];

/**
 * Mantém o idioma da tela igual ao do perfil (o perfil vem antes do cookie):
 * - perfil com idioma diferente (trocado em outro aparelho): ajusta o cookie e atualiza a página, sem perder a tela;
 * - perfil ainda sem idioma, região ou unidade (conta nova): grava o que está valendo agora. O idioma só SUGERE
 *   região e unidade uma vez; depois de gravadas, trocar o idioma não muda loja, compra, feriados nem kg/lb.
 */
export function LocaleSync() {
  const { snap } = useStore();
  const locale = useLocale();
  const router = useRouter();
  const tried = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const saving = useRef(false);
  const me = snap?.me;
  const saved = me?.locale;
  const missing = !!me && (!me.locale || !me.region || !me.weightUnit);

  useEffect(() => {
    if (!me || !saved || saved === locale) return;
    if (tried.current === saved) return; // cookie bloqueado: não fica atualizando sem parar
    tried.current = saved;
    document.cookie = localeCookie(saved);
    router.refresh();
  }, [me, saved, locale, router]);

  const setPrefs = useSetPreferences();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    // "saving" cobre a gravação em andamento e a espera até a próxima tentativa.
    if (!missing || !me || saving.current || attempt > AUTO_RETRY_MS.length) return;
    const base = me.locale ?? locale;
    const p: Prefs = {};
    if (!me.locale) p.locale = base;
    if (!me.region) p.region = defaultRegion(base);
    if (!me.weightUnit) p.weightUnit = defaultWeightUnit(base);
    saving.current = true;
    void setPrefs(p, { quiet: true }).then((ok) => {
      if (ok || attempt >= AUTO_RETRY_MS.length) { saving.current = false; return; }
      const again = () => {
        clearTimeout(timer.current);
        window.removeEventListener("online", again);
        saving.current = false;
        setAttempt((n) => n + 1);
      };
      timer.current = setTimeout(again, AUTO_RETRY_MS[attempt]);
      window.addEventListener("online", again);
    });
  }, [missing, me, locale, attempt, setPrefs]);
  return null;
}

/** Salvamentos em fila: toques rápidos (kg → lb) chegam ao servidor na ordem em que a pessoa escolheu. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Troca de preferências da pessoa. Devolve false se o servidor não gravou (e aí nada muda: perfil, cookie e tela
 * continuam iguais). Sem conta: só o cookie de idioma.
 * - Idioma: grava primeiro (perfil + metadados do login) e só então troca o cookie e atualiza a página, sem
 *   recarregar (formulários, envios e artes em andamento continuam).
 * - Região e unidade: mudam na tela na hora e voltam ao valor anterior se a gravação falhar.
 */
export function useSetPreferences() {
  const { snap, patchSnap } = useStore();
  const router = useRouter();
  const current = useLocale();
  const me = snap?.me;
  return async (p: Prefs, opts: { quiet?: boolean } = {}): Promise<boolean> => {
    if (!me) {
      if (p.locale) { document.cookie = localeCookie(p.locale); router.refresh(); }
      return true;
    }
    const full: Prefs = { ...p };
    if (p.locale && !opts.quiet) {
      // A região e a unidade ainda sugeridas pelo idioma ficam fixas antes de trocar o idioma.
      const base = me.locale ?? current;
      if (!me.region && !full.region) full.region = defaultRegion(base);
      if (!me.weightUnit && !full.weightUnit) full.weightUnit = defaultWeightUnit(base);
    }
    const apply = (v: Prefs) => patchSnap((s) => (s.me ? { ...s, me: { ...s.me, ...v } } : s));
    const instant: Prefs = { region: full.region, weightUnit: full.weightUnit };
    for (const k of Object.keys(instant) as (keyof Prefs)[]) if (instant[k] === undefined) delete instant[k];
    const before: Prefs = { region: me.region ?? undefined, weightUnit: me.weightUnit ?? undefined };
    if (!p.locale) apply(instant);
    const save = queue.then(() => rpc("setPreferences", full));
    queue = save.catch(() => undefined);
    try {
      await save;
    } catch {
      if (!p.locale) {
        // Volta só o que ainda está com o valor que falhou (um toque mais novo vale mais).
        patchSnap((s) => {
          if (!s.me) return s;
          const back: Record<string, unknown> = {};
          if (instant.region && s.me.region === instant.region) back.region = before.region ?? null;
          if (instant.weightUnit && s.me.weightUnit === instant.weightUnit) back.weightUnit = before.weightUnit ?? null;
          return { ...s, me: { ...s.me, ...back } };
        });
      }
      return false;
    }
    if (p.locale || opts.quiet) apply(full);
    if (p.locale && p.locale !== current) { document.cookie = localeCookie(p.locale); router.refresh(); }
    return true;
  };
}

/** Salvar uma preferência com aviso de falha e "Tentar de novo". */
export function usePreferenceSaver() {
  const setPrefs = useSetPreferences();
  const [failed, setFailed] = useState<Prefs | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (p: Prefs) => {
    setFailed(null);
    setBusy(true);
    const ok = await setPrefs(p);
    setBusy(false);
    if (!ok) setFailed(p);
    return ok;
  };
  return { save, busy, failed, retry: () => (failed ? save(failed) : Promise.resolve(true)) };
}

export function PrefsSaveError({ failed, retry, busy }: { failed: Prefs | null; retry: () => unknown; busy?: boolean }) {
  const t = useTranslations("forms");
  if (!failed) return null;
  return (
    <p className="field-error prefs-error" role="alert">
      {t("prefsFailed")}{" "}
      <button type="button" className="prefs-error__retry" onClick={() => void retry()} disabled={busy}>{t("prefsRetry")}</button>
    </p>
  );
}
