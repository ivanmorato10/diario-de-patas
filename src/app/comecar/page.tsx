"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore, useBlobUrl } from "@/data/store";
import { DomainError, type ProcessedImage } from "@/data/demo-repository";
import { detectTimezone, isCivilDate } from "@/domain/dates";
import { LIMITS } from "@/config/business";
import { PhotoPicker } from "@/components/photo-picker";
import { PreferencesFields, TimezoneSelect } from "@/components/profile-fields";
import { DemoBanner, StorageUnavailable } from "@/components/shell";
import { IconArrowLeft, IconInfo } from "@/components/icons";
import { AbuSays } from "@/components/brand";
import type { DogPreferences } from "@/domain/types";

export default function Comecar() {
  const { repo, snap, reload, unavailable } = useStore();
  const router = useRouter();
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [photo, setPhoto] = useState<ProcessedImage | null>(null);
  const [prefs, setPrefs] = useState<DogPreferences>({ home: true, outdoor: true, people: true, socialDogs: false });
  const [tz, setTz] = useState("America/Sao_Paulo");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const photoUrl = useBlobUrl(photo?.thumb);

  useEffect(() => setTz(detectTimezone()), []);
  useEffect(() => {
    if (snap?.dog) router.replace("/hoje");
  }, [snap, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!repo || saving) return;
    if (!name.trim()) {
      setError("Conte para a gente o nome do seu cachorro.");
      document.getElementById("dog-name")?.focus();
      return;
    }
    if (birth && !isCivilDate(birth)) {
      setError("Essa data não parece válida.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await repo!.createDiary({ timezone: tz, name, birthDate: birth || null, preferences: prefs, photo });
      await reload();
      router.replace("/hoje");
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Não conseguimos criar o diário. Tente novamente.");
      setSaving(false);
    }
  }

  return (
    <div className="shell">
      <DemoBanner />
      <header className="topbar"><div className="topbar__inner"><Link href="/bem-vindo" className="icon-btn" aria-label="Voltar"><IconArrowLeft /></Link></div></header>
      <main className="main main--bare">
        {unavailable ? <StorageUnavailable /> : (
          <form className="stack-lg" onSubmit={submit} noValidate>
            <div className="stack">
              <h1>Vamos criar o diário</h1>
              <AbuSays>Me conta: como se chama o seu melhor amigo?</AbuSays>
              <p className="muted">Só o nome é obrigatório. O resto você ajusta quando quiser.</p>
            </div>

            <div className="field">
              <label htmlFor="dog-name">Nome do cachorro</label>
              <input id="dog-name" className="input" value={name} maxLength={LIMITS.dogNameMaxChars} onChange={(e) => setName(e.target.value)} autoComplete="off" aria-invalid={!!error && !name.trim()} required />
            </div>

            <div className="field">
              <span className="label">Foto de perfil <span className="muted">(opcional)</span></span>
              {photo && photoUrl ? (
                <div className="row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl} alt="Foto de perfil escolhida" className="avatar avatar--xl" />
                  <button type="button" className="btn btn--ghost" onClick={() => setPhoto(null)}>Remover</button>
                </div>
              ) : <PhotoPicker onPicked={setPhoto} compact />}
            </div>

            <div className="field">
              <label htmlFor="birth">Data de nascimento <span className="muted">(opcional)</span></label>
              <input id="birth" type="date" className="input" value={birth} onChange={(e) => setBirth(e.target.value)} />
            </div>

            <PreferencesFields value={prefs} onChange={setPrefs} />

            <div className="field">
              <label htmlFor="tz">Fuso horário</label>
              <TimezoneSelect id="tz" value={tz} onChange={setTz} />
              <span className="hint">Detectamos este fuso pelo aparelho. Ele organiza as datas do diário.</span>
            </div>

            <div className="notice notice--info">
              <IconInfo />
              <span>O diário é privado. Nada é compartilhado até você escolher. Neste modo de demonstração, tudo fica salvo só neste navegador.</span>
            </div>

            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <button type="submit" className="btn btn--primary btn--block" disabled={saving || !repo}>
              {saving ? "Criando…" : "Criar meu diário"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
