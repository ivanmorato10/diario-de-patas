"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { DomainError } from "@/data/demo-repository";
import { LIMITS } from "@/config/business";
import { isCivilDate, isValidTimezone } from "@/domain/dates";
import type { DogPreferences } from "@/domain/types";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { PhotoPicker } from "@/components/photo-picker";
import { PreferencesFields, TimezoneSelect } from "@/components/profile-fields";
import { DogAvatar } from "@/components/media";
import { IconChevron, IconDownload, IconInfo } from "@/components/icons";

export default function Config() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo, reload, reset } = useStore();
  const router = useRouter();
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [prefs, setPrefs] = useState<DogPreferences | null>(null);
  const [tz, setTz] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (snap?.dog && prefs === null) {
      setName(snap.dog.name);
      setBirth(snap.dog.birthDate ?? "");
      setPrefs(snap.dog.preferences);
      setTz(snap.profile?.timezone ?? "");
    }
  }, [snap, prefs]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !prefs || !repo) return <main className="main"><PageLoading /></main>;
  const dog = snap.dog;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      await reload();
      setMsg({ kind: "ok", text: ok });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof DomainError ? e.message : "Não conseguimos salvar. Tente novamente." });
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (birth && !isCivilDate(birth)) return setMsg({ kind: "error", text: "Essa data não parece válida." });
    if (!isValidTimezone(tz)) return setMsg({ kind: "error", text: "Fuso horário inválido." });
    await run(async () => {
      await repo!.updateDog({ name, birthDate: birth || null, preferences: prefs! });
      await repo!.updateTimezone(tz);
    }, "Perfil salvo.");
  }

  async function doExport() {
    const data = await repo!.exportMetadata();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diario-de-patas-${snap!.today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function wipe() {
    await reset();
    router.replace("/bem-vindo");
  }

  return (
    <>
      <TopBar title="Perfil e ajustes" back="/hoje" />
      <main className="main">
        <form className="stack-lg" onSubmit={saveProfile}>
          <section className="stack" aria-labelledby="perfil">
            <h2 id="perfil">Perfil</h2>
            <div className="row">
              <DogAvatar mediaId={dog.photoMediaId} name={dog.name} size="xl" />
              <div className="stack" style={{ gap: 6 }}>
                <PhotoPicker compact onPicked={(p) => run(() => repo!.updateDog({ photo: p }), "Foto atualizada.")} />
                {dog.photoMediaId ? <button type="button" className="btn btn--ghost btn--small" onClick={() => run(() => repo!.updateDog({ photo: null }), "Foto removida.")}>Remover foto</button> : null}
              </div>
            </div>
            <div className="field">
              <label htmlFor="name">Nome</label>
              <input id="name" className="input" value={name} maxLength={LIMITS.dogNameMaxChars} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="birth">Data de nascimento <span className="muted">(opcional)</span></label>
              <input id="birth" type="date" className="input" value={birth} onChange={(e) => setBirth(e.target.value)} />
            </div>
          </section>
          <PreferencesFields value={prefs} onChange={setPrefs} />
          <div className="field">
            <label htmlFor="tz">Fuso horário</label>
            <TimezoneSelect id="tz" value={tz} onChange={setTz} />
            <span className="hint">Usado para organizar as datas do diário.</span>
          </div>
          {msg ? <p role={msg.kind === "error" ? "alert" : "status"} className={msg.kind === "error" ? "field-error" : "notice notice--positive"}>{msg.text}</p> : null}
          <button type="submit" className="btn btn--primary btn--block">Salvar perfil</button>
        </form>

        <section className="card stack" aria-labelledby="uso">
          <h2 id="uso">Uso desta versão de teste</h2>
          <dl className="stack small" style={{ margin: 0, gap: 6 }}>
            <div className="row-between"><dt className="muted">Lembranças</dt><dd style={{ margin: 0 }}>{snap.entries.length} de {LIMITS.maxEntries}</dd></div>
            <div className="row-between"><dt className="muted">Tamanho máximo por foto</dt><dd style={{ margin: 0 }}>{LIMITS.maxUploadBytes / 1024 / 1024} MB</dd></div>
            <div className="row-between"><dt className="muted">Créditos do estúdio</dt><dd style={{ margin: 0 }}>0 (ainda não disponível)</dd></div>
          </dl>
          <p className="caption">São limites de teste, não promessas de armazenamento. Nada é apagado ao atingir um limite.</p>
        </section>

        <section className="card stack" aria-labelledby="links">
          <h2 id="links">Links compartilhados</h2>
          <p className="small muted">Nenhum link ativo. Compartilhamento chega junto com contas.</p>
        </section>

        <section className="stack" aria-labelledby="dados">
          <h2 id="dados">Seus dados</h2>
          <button type="button" className="btn btn--secondary btn--block" onClick={doExport}><IconDownload /> Exportar dados (JSON)</button>
          <p className="caption">Inclui perfil, legendas, datas, álbuns e conquistas. As fotos você baixa uma a uma pelo Diário.</p>
          <Link href="/sobre" className="card row-between" style={{ padding: 16 }}><span>Sobre o Diário de Patas</span><IconChevron /></Link>
        </section>

        <section className="card stack" aria-labelledby="apagar" style={{ borderColor: "#f1c4bf" }}>
          <h2 id="apagar">Apagar diário</h2>
          <p className="small">Remove o perfil, todas as fotos, álbuns e conquistas deste aparelho. Não dá para desfazer.</p>
          <div className="notice notice--info"><IconInfo /><span>Nesta demonstração não existe conta em servidor: apagar aqui remove tudo o que existe.</span></div>
          <div className="field">
            <label htmlFor="confirm">Para confirmar, digite o nome: <strong>{dog.name}</strong></label>
            <input id="confirm" className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </div>
          <button type="button" className="btn btn--danger-outline btn--block" disabled={confirmText.trim() !== dog.name} onClick={wipe}>Apagar tudo</button>
        </section>
      </main>
    </>
  );
}
