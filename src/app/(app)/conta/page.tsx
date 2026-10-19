"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/i18n/use-error";
import { usePrefs } from "@/i18n/use-format";
import { LOCALE_NAMES, REGIONS, WEIGHT_UNITS } from "@/i18n/locale";
import { LanguageSwitch } from "@/components/language-switch";
import { useSetPreferences } from "@/components/locale-sync";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { browserClient } from "@/data/supabase-browser";
import { isValidTimezone } from "@/domain/dates";
import { PageLoading, StorageUnavailable, TopBar } from "@/components/shell";
import { MyNameField } from "@/components/name-ask";
import { ShareApp } from "@/components/share-app";
import { FamilyDiaries } from "@/components/family-diaries";
import { NotificationSettings } from "@/components/notifications";
import { SignOutForm } from "@/components/sign-out";
import { InstallAppLink } from "@/components/install-app";
import { TimezoneSelect } from "@/components/profile-fields";
import { IconChevron } from "@/components/icons";
import { Sheet } from "@/components/entry-actions";

type Panel = "name" | "family" | "notify" | "tz" | "lang" | "delete" | null;

/** Minha conta: quem é você (nome e email) e linhas que abrem cada ajuste — como o Perfil do cachorro. */
export default function Conta() {
  const { snap, repo, reload, reset, unavailable } = useStore();
  const router = useRouter();
  const [account, setAccount] = useState<{ email: string; via: string } | null>(null);
  const [tz, setTz] = useState<string | null>(null);
  const [tzMsg, setTzMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const t = useTranslations("account");
  const errText = useErrorText();
  const prefs = usePrefs();
  const setPrefs = useSetPreferences();
  const CONFIRM_WORD = t("confirmWord");

  useEffect(() => {
    browserClient().auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const p = u.app_metadata?.provider;
      setAccount({ email: u.email ?? "", via: p === "google" ? "Google" : p === "apple" ? "Apple" : "email" });
    });
  }, []);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!snap || !repo) return <main className="main"><PageLoading /></main>;
  const tzValue = tz ?? snap.profile?.timezone ?? "America/Sao_Paulo";
  const tzDirty = tzValue !== (snap.profile?.timezone ?? "America/Sao_Paulo");
  const others = (snap.diaries ?? []).filter((d) => !d.mine).length;
  const Row = ({ id, icon, label, sub }: { id: Panel; icon: string; label: string; sub?: string }) => (
    <button type="button" className="card row-between profile-row" onClick={() => setPanel(id)}>
      <span className="profile-row__text"><span>{icon} {label}</span>{sub ? <span className="caption">{sub}</span> : null}</span>
      <IconChevron />
    </button>
  );

  async function saveTz(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidTimezone(tzValue)) return setTzMsg(errText("errors.invalidTimezone"));
    try {
      await repo!.updateTimezone(tzValue);
      await reload();
      setTz(null);
      setTzMsg(t("tzSaved"));
    } catch {
      setTzMsg(errText("errors.nameSaveFailed"));
    }
  }

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      await reset(); // exclui no servidor e limpa as fotos guardadas neste aparelho
      router.replace("/entrar");
    } catch (e) {
      setError(errText(e instanceof Error ? e.message : "account.deleteFailed"));
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title={t("title")} back="/hoje" emoji="👤" />
      <main className="main">
        {/* Quem é você: nome e forma de entrar; embaixo, linhas que abrem cada ajuste. */}
        <section className="profile-head" aria-labelledby="voce">
            <span className="account-avatar" aria-hidden="true">{(snap.me?.name || "?")[0].toUpperCase()}</span>
            <div className="stack" style={{ gap: 2, minWidth: 0 }}>
              <h2 id="voce" className="profile-head__name">{snap.me?.nameConfirmed ? snap.me.name : t("you")}</h2>
              {account ? <><span className="small" style={{ overflowWrap: "anywhere" }}>{account.email}</span><span className="caption">{t("signsInWith", { via: account.via === "email" ? t("email") : account.via })}</span></> : null}
            </div>
        </section>

        <section className="stack" style={{ gap: 8 }} aria-label={t("settings")}>
          <Row id="name" icon="✏️" label={t("name")} sub={snap.me?.nameConfirmed ? t("nameSeen", { name: snap.me.name }) : t("nameSub")} />
          {/* Idioma é da pessoa (não do cachorro); o rótulo aparece nos dois idiomas para quem procura. */}
          <Row id="lang" icon="🌎" label="Idioma / Language" sub={`${LOCALE_NAMES[prefs.locale]} · ${t(`regions.${prefs.region}`)} · ${prefs.weightUnit}`} />
          {others > 0 ? <Row id="family" icon="👨‍👩‍👧" label={t("familyDiaries")} sub={t("othersDiaries", { count: others })} /> : null}
          <Row id="notify" icon="🔔" label={t("notifications")} sub={t("notificationsSub")} />
          <Row id="tz" icon="🕐" label={t("timezone")} sub={tzValue.replace(/_/g, " ")} />
          <ShareApp />
          <Link href="/achadinhos" className="card row-between profile-row"><span className="profile-row__text"><span>🛍️ {t("finds")}</span></span><IconChevron /></Link>
          <Link href="/sobre" className="card row-between profile-row"><span className="profile-row__text"><span>🐾 {t("about")}</span></span><IconChevron /></Link>
          <InstallAppLink variant="row" />
          <SignOutForm style={{ display: "contents" }}>
              {(busy) => <button type="submit" className="card row-between profile-row" disabled={busy}><span className="profile-row__text"><span>🚪 {busy ? t("signingOut") : t("signOut")}</span></span><IconChevron /></button>}
          </SignOutForm>
          <Row id="delete" icon="🗑️" label={t("delete")} />
        </section>

        <Sheet open={panel === "name"} onClose={() => setPanel(null)} labelledBy="c-name">
          <h2 id="c-name">{t("name")}</h2>
          <MyNameField />
          <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={() => setPanel(null)}>{t("close")}</button>
        </Sheet>

        <Sheet open={panel === "lang"} onClose={() => setPanel(null)} labelledBy="c-lang">
          <h2 id="c-lang">Idioma / Language</h2>
          <div className="stack">
            <LanguageSwitch />
            <p className="caption" style={{ margin: 0 }}>{t("langNote")}</p>
            <div className="stack" style={{ gap: 6 }} role="radiogroup" aria-labelledby="c-region">
              <span id="c-region" className="label" style={{ fontWeight: 600 }}>{t("region")}</span>
              <div className="filter-row">
                {REGIONS.map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={prefs.region === r} className={`filter-chip${prefs.region === r ? " is-active" : ""}`} onClick={() => void setPrefs({ region: r })}>{t(`regions.${r}`)}</button>
                ))}
              </div>
              <span className="caption">{t("regionNote")}</span>
            </div>
            <div className="stack" style={{ gap: 6 }} role="radiogroup" aria-labelledby="c-unit">
              <span id="c-unit" className="label" style={{ fontWeight: 600 }}>{t("unit")}</span>
              <div className="filter-row">
                {WEIGHT_UNITS.map((u) => (
                  <button key={u} type="button" role="radio" aria-checked={prefs.weightUnit === u} className={`filter-chip${prefs.weightUnit === u ? " is-active" : ""}`} onClick={() => void setPrefs({ weightUnit: u })}>{t(`units.${u}`)}</button>
                ))}
              </div>
              <span className="caption">{t("unitNote")}</span>
            </div>
          </div>
          <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={() => setPanel(null)}>{t("close")}</button>
        </Sheet>

        <Sheet open={panel === "family"} onClose={() => setPanel(null)} labelledBy="familias">
          <FamilyDiaries />
          <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={() => setPanel(null)}>{t("close")}</button>
        </Sheet>

        <Sheet open={panel === "notify"} onClose={() => setPanel(null)} labelledBy="c-notify">
          <h2 id="c-notify">{t("notifications")}</h2>
          <NotificationSettings />
          <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={() => setPanel(null)}>{t("close")}</button>
        </Sheet>

        <Sheet open={panel === "tz"} onClose={() => { setPanel(null); setTz(null); setTzMsg(null); }} labelledBy="fuso">
          <form className="stack" onSubmit={saveTz}>
            <h2 id="fuso">{t("timezone")}</h2>
            <TimezoneSelect id="tz" value={tzValue} onChange={(v) => { setTz(v); setTzMsg(null); }} />
            <span className="hint">{t("tzHint")}</span>
            {tzMsg ? <p className="small" role="status" style={{ margin: 0 }}>{tzMsg}</p> : null}
            {tzDirty ? <button type="submit" className="btn btn--primary btn--block">{t("tzSave")}</button> : null}
            <button type="button" className="btn btn--secondary btn--block" onClick={() => { setPanel(null); setTz(null); setTzMsg(null); }}>{t("close")}</button>
          </form>
        </Sheet>

        <Sheet open={panel === "delete"} onClose={() => setPanel(null)} labelledBy="excluir">
          <h2 id="excluir">{t("delete")}</h2>
          <p className="small">{t("deleteText")}</p>
          <div className="field">
            <label htmlFor="confirm-conta">{t.rich("confirmLabel", { word: CONFIRM_WORD, strong: (c) => <strong>{c}</strong> })}</label>
            <input id="confirm-conta" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoCapitalize="characters" />
          </div>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <div className="stack" style={{ gap: 8 }}>
            <button type="button" className="btn btn--danger-outline btn--block" disabled={confirm.trim().toUpperCase() !== CONFIRM_WORD || busy} onClick={deleteAccount}>{busy ? t("deleting") : t("delete")}</button>
            <button type="button" className="btn btn--secondary btn--block" onClick={() => setPanel(null)}>{t("close")}</button>
          </div>
        </Sheet>
      </main>
    </>
  );
}
