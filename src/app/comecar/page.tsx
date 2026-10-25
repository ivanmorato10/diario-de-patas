"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/i18n/use-error";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore, useBlobUrl } from "@/data/store";
import { DomainError, type ProcessedImage } from "@/data/demo-repository";
import { detectTimezone, isCivilDate } from "@/domain/dates";
import { LIMITS } from "@/config/business";
import { PhotoPicker } from "@/components/photo-picker";
import { ImportDemoCard } from "@/components/import-demo";
import { PreferencesFields, TimezoneSelect } from "@/components/profile-fields";
import { StorageUnavailable } from "@/components/shell";
import { IconArrowLeft, IconInfo, IconTrash } from "@/components/icons";
import { AbuSays } from "@/components/brand";
import type { DogPreferences } from "@/domain/types";

export default function Comecar() {
  const { repo, snap, reload, unavailable } = useStore();
  const router = useRouter();
  const [name, setName] = useState("");
  const [nick, setNick] = useState("");
  const [birth, setBirth] = useState("");
  const [photo, setPhoto] = useState<ProcessedImage | null>(null);
  const [prefs, setPrefs] = useState<DogPreferences>({ home: true, outdoor: true, people: true, socialDogs: false });
  const [tz, setTz] = useState("America/Sao_Paulo");
  const [errorKey, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  /** Diário criado mas a foto não subiu: guarda para onde seguir; a tela oferece só reenviar a foto. */
  const [photoOnly, setPhotoOnly] = useState<string | null>(null);
  const t = useTranslations("start");
  const errText = useErrorText();
  const error = errorKey ? errText(errorKey) : null;
  const photoUrl = useBlobUrl(photo?.thumb);

  // ?novo=1: mais um cachorro na mesma conta (só com conta; cada diário tem seus créditos e sua família).
  const [another, setAnother] = useState<boolean | null>(null);
  useEffect(() => {
    setTz(detectTimezone());
    setAnother(new URLSearchParams(window.location.search).get("novo") === "1");
  }, []);
  useEffect(() => {
    // Quem já tem diário e abriu esta tela vai para Hoje — mas não logo depois de criar (aí vai com o convite).
    if (snap?.dog && another === false && !saving) router.replace("/hoje");
  }, [snap, router, another, saving]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!repo || saving) return;
    if (photoOnly) return retryPhoto(); // o diário já existe: nunca cria de novo
    if (!name.trim()) {
      setError("errors.dogNameRequired");
      document.getElementById("dog-name")?.focus();
      return;
    }
    if (birth && !isCivilDate(birth)) {
      setError("validation.invalidDate");
      return;
    }
    setSaving(true);
    setError(null);
    const next = another && snap?.dog ? "/hoje" : "/hoje?bemvindo=1"; // primeiro diário: convite da família
    try {
      await repo!.createDiary({ timezone: tz, name, nickname: nick.trim() || null, birthDate: birth || null, preferences: prefs, photo, another: !!another && !!snap?.dog });
    } catch (err) {
      // Diário criado, só a foto falhou: não pede para criar de novo (isso duplicaria o diário).
      if (err instanceof DomainError && err.code === "PHOTO_AFTER_CREATE") { setPhotoOnly(next); setError(err); setSaving(false); return; }
      setError(err instanceof DomainError ? err : "errors.createDiaryFailed");
      setSaving(false);
      return;
    }
    await goToDiary(next);
  }

  /** O diário novo precisa estar carregado para abrir Hoje; se a conferência falhar, abre o app do zero. */
  async function goToDiary(next: string) {
    try { await reload(); router.replace(next); } catch { window.location.assign(next); }
  }

  /** Só a foto, no diário que já foi criado (o cachorro novo já é o desta tela). */
  async function retryPhoto() {
    if (!repo || !photo || saving || !photoOnly) return;
    setSaving(true);
    setError(null);
    try {
      await repo.updateDog({ photo });
    } catch (err) {
      setError(err instanceof DomainError ? err : "errors.diaryCreatedPhotoFailed");
      setSaving(false);
      return;
    }
    await goToDiary(photoOnly);
  }

  return (
    <div className="shell">
      <header className="topbar"><div className="topbar__inner"><Link href="/adicionar" className="icon-btn" aria-label={t("back")}><IconArrowLeft /></Link></div></header>
      <main className="main main--bare">
        {another ? null : <ImportDemoCard />}
        {unavailable ? <StorageUnavailable /> : (
          <form className="stack-lg" onSubmit={submit} noValidate>
            <div className="stack">
              <h1>{another && snap?.dog ? t("titleAnother") : t("title")}</h1>
              <AbuSays>{another && snap?.dog ? t("abuAnother") : t("abu")}</AbuSays>
              <p className="muted">{t("onlyName")}</p>
            </div>

            <div className="field">
              <label htmlFor="dog-name">{t("dogName")}</label>
              <input id="dog-name" className="input" value={name} maxLength={LIMITS.dogNameMaxChars} onChange={(e) => setName(e.target.value)} autoComplete="off" aria-invalid={!!error && !name.trim()} required />
            </div>

            {/* Apelido logo no cadastro: assim a pessoa já sabe que existe (muda depois no perfil). */}
            <div className="field">
              <label htmlFor="dog-nick">{t("nick")} <span className="muted">{t("optional")}</span></label>
              <input id="dog-nick" className="input" value={nick} maxLength={30} placeholder={t("nickPlaceholder")} onChange={(e) => setNick(e.target.value)} autoComplete="off" />
              <span className="hint">{t("nickHint")}</span>
            </div>

            <div className="field">
              <span className="label">{t("photo")} <span className="muted">{t("optional")}</span></span>
              {photo && photoUrl ? (
                <div className="row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl} alt={t("photoAlt")} className="avatar avatar--xl" />
                  <button type="button" className="btn btn--secondary btn--small" onClick={() => setPhoto(null)}><IconTrash /> {t("removePhoto")}</button>
                </div>
              ) : <PhotoPicker onPicked={setPhoto} compact />}
            </div>

            <div className="field">
              <label htmlFor="birth">{t("birth")} <span className="muted">{t("optional")}</span></label>
              <input id="birth" type="date" className="input" value={birth} onChange={(e) => setBirth(e.target.value)} />
            </div>

            {/* Nome e foto bastam para começar; o resto já vem num jeito bom e muda depois em Ajustes. */}
            <details className="adjust-later">
              <summary>{t("adjustLater")}</summary>
              <div className="stack" style={{ marginTop: 12 }}>
                <PreferencesFields value={prefs} onChange={setPrefs} />
                <div className="field">
                  <label htmlFor="tz">{t("timezone")}</label>
                  <TimezoneSelect id="tz" value={tz} onChange={setTz} />
                  <span className="hint">{t("timezoneHint")}</span>
                </div>
              </div>
            </details>

            <div className="notice notice--info">
              <IconInfo />
              <span>{t("private")}</span>
            </div>

            {error ? <p className="field-error" role="alert">{error}</p> : null}
            {photoOnly ? (
              <div className="stack" style={{ gap: 8 }}>
                <button type="button" className="btn btn--primary btn--block" disabled={saving} onClick={retryPhoto}>{saving ? t("creating") : t("photoRetry")}</button>
                <button type="button" className="btn btn--secondary btn--block" disabled={saving} onClick={() => void goToDiary(photoOnly)}>{t("continueWithout")}</button>
                <p className="caption" style={{ margin: 0, textAlign: "center" }}>{t("photoLater")}</p>
              </div>
            ) : (
              <button type="submit" className="btn btn--primary btn--block" disabled={saving || !repo}>
                {saving ? t("creating") : t("create")}
              </button>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
