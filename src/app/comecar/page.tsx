"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { REAL_MODE } from "@/config/mode";
import { useStore, useBlobUrl } from "@/data/store";
import { DomainError, type ProcessedImage } from "@/data/demo-repository";
import { detectTimezone, isCivilDate } from "@/domain/dates";
import { LIMITS } from "@/config/business";
import { PhotoPicker } from "@/components/photo-picker";
import { ImportDemoCard } from "@/components/import-demo";
import { PreferencesFields, TimezoneSelect } from "@/components/profile-fields";
import { DemoBanner, StorageUnavailable } from "@/components/shell";
import { IconArrowLeft, IconInfo, IconTrash } from "@/components/icons";
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

  // ?novo=1: mais um cachorro na mesma conta (só com conta; cada diário tem seus créditos e sua família).
  const [another, setAnother] = useState<boolean | null>(null);
  useEffect(() => {
    setTz(detectTimezone());
    setAnother(REAL_MODE && new URLSearchParams(window.location.search).get("novo") === "1");
  }, []);
  useEffect(() => {
    if (snap?.dog && another === false) router.replace("/hoje");
  }, [snap, router, another]);

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
      await repo!.createDiary({ timezone: tz, name, birthDate: birth || null, preferences: prefs, photo, another: !!another && !!snap?.dog });
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
      <header className="topbar"><div className="topbar__inner"><Link href={REAL_MODE ? "/adicionar" : "/bem-vindo"} className="icon-btn" aria-label="Voltar"><IconArrowLeft /></Link></div></header>
      <main className="main main--bare">
        {another ? null : <ImportDemoCard />}
        {unavailable ? <StorageUnavailable /> : (
          <form className="stack-lg" onSubmit={submit} noValidate>
            <div className="stack">
              <h1>{another && snap?.dog ? "Mais um cachorro na família!" : "Vamos criar o diário"}</h1>
              <AbuSays>{another && snap?.dog ? "Que legal, mais um amigo! Ele ganha um diário só dele, com missões e créditos próprios." : "Me conta: como se chama o seu melhor amigo?"}</AbuSays>
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
                  <button type="button" className="btn btn--secondary btn--small" onClick={() => setPhoto(null)}><IconTrash /> Remover foto</button>
                </div>
              ) : <PhotoPicker onPicked={setPhoto} compact />}
            </div>

            <div className="field">
              <label htmlFor="birth">Data de nascimento <span className="muted">(opcional)</span></label>
              <input id="birth" type="date" className="input" value={birth} onChange={(e) => setBirth(e.target.value)} />
            </div>

            {/* Nome e foto bastam para começar; o resto já vem num jeito bom e muda depois em Ajustes. */}
            <details className="adjust-later">
              <summary>Ajustar depois: rotina e fuso horário</summary>
              <div className="stack" style={{ marginTop: 12 }}>
                <PreferencesFields value={prefs} onChange={setPrefs} />
                <div className="field">
                  <label htmlFor="tz">Fuso horário</label>
                  <TimezoneSelect id="tz" value={tz} onChange={setTz} />
                  <span className="hint">Detectamos este fuso pelo aparelho. Ele organiza as datas do diário.</span>
                </div>
              </div>
            </details>

            <div className="notice notice--info">
              <IconInfo />
              <span>O diário é privado. Nada é compartilhado até você escolher.{REAL_MODE ? "" : " Neste modo de demonstração, tudo fica salvo só neste navegador."}</span>
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
