"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { DomainError } from "@/data/demo-repository";
import { LIMITS } from "@/config/business";
import { REAL_MODE } from "@/config/mode";
import { rpc } from "@/data/real-repository";
import { ShareLinksList } from "@/components/share";
import { ImportDemoCard } from "@/components/import-demo";
import { AvatarCropSheet } from "@/components/avatar-crop";
import { FamilySection } from "@/components/family-section";
import { DogList } from "@/components/dog-switcher";
import { isCivilDate } from "@/domain/dates";
import type { DogPreferences } from "@/domain/types";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { PhotoPicker } from "@/components/photo-picker";
import { PreferencesFields } from "@/components/profile-fields";
import { DogAvatar } from "@/components/media";
import { IconChevron, IconInfo, IconStar } from "@/components/icons";
import { levelFor } from "@/domain/missions";

/**
 * Perfil do cachorro: tudo o que é DELE (e a família vê igual) — foto, nome, aniversário, rotina,
 * patinhas, família, links compartilhados e "Seus cachorros". O que é da pessoa fica em Minha conta.
 */
export default function Perfil() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { repo, reload, reset, patchSnap } = useStore();
  const router = useRouter();
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [prefs, setPrefs] = useState<DogPreferences | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (snap?.dog && prefs === null) {
      setName(snap.dog.name);
      setBirth(snap.dog.birthDate ?? "");
      setPrefs(snap.dog.preferences);
    }
  }, [snap, prefs]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !prefs || !repo) return <main className="main"><PageLoading /></main>;
  const dog = snap.dog;
  const viewer = snap.role === "viewer";
  // Salvar perfil só fica ativo quando algo mudou.
  const dirty = name.trim() !== dog.name || birth !== (dog.birthDate ?? "") || JSON.stringify(prefs) !== JSON.stringify(dog.preferences);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      await reload();
      setMsg({ kind: "ok", text: ok });
      return true;
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof DomainError ? e.message : "Não conseguimos salvar. Tente novamente." });
      return false;
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (birth && !isCivilDate(birth)) return setMsg({ kind: "error", text: "Essa data não parece válida." });
    await run(() => repo!.updateDog({ name, birthDate: birth || null, preferences: prefs! }), "Perfil salvo.");
  }

  async function wipe() {
    if (REAL_MODE) {
      setDeleting(true);
      setDeleteError(null);
      try {
        await rpc("deleteDiary", { confirmName: confirmText.trim() });
        await reload();
        router.replace("/");
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : "Não deu para apagar agora.");
        setDeleting(false);
      }
      return;
    }
    await reset();
    router.replace("/bem-vindo");
  }

  return (
    <>
      <TopBar title={`Perfil de ${dog.name}`} back="/hoje" />
      <main className="main">
        {dog.photoMediaId && cropOpen ? (
          <AvatarCropSheet open mediaId={dog.photoMediaId} name={dog.name} value={dog.avatarCrop} onClose={() => setCropOpen(false)}
            onSave={(c) => {
              // A foto muda na hora; o servidor grava em seguida (e o reload confirma).
              patchSnap((s) => (s.dog ? { ...s, dog: { ...s.dog, avatarCrop: c } } : s));
              void run(() => repo!.updateDog({ avatarCrop: c }), "Foto ajustada.");
            }} />
        ) : null}
        <form className="stack-lg" onSubmit={saveProfile}>
          {viewer ? <p className="notice notice--info small"><IconInfo size={18} /><span>Você está acompanhando o diário de {dog.name}. Para mudar o perfil, peça para quem é responsável pelo diário.</span></p> : null}
          <fieldset disabled={viewer} className="stack-lg" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <section className="stack" aria-labelledby="perfil">
            <h2 id="perfil" className="sr-only">Perfil</h2>
            <div className="row">
              {/* Como no LinkedIn: o ajuste abre ao escolher a foto; depois, é só tocar nela para reajustar. */}
              {dog.photoMediaId && !viewer ? (
                <button type="button" className="avatar-edit" onClick={() => setCropOpen(true)} aria-label={`Ajustar zoom e posição da foto de ${dog.name}`}>
                  <DogAvatar mediaId={dog.photoMediaId} name={dog.name} crop={dog.avatarCrop} size="xl" />
                  <span className="avatar-edit__hint" aria-hidden="true">Ajustar</span>
                </button>
              ) : (
                <DogAvatar mediaId={dog.photoMediaId} name={dog.name} crop={dog.avatarCrop} size="xl" />
              )}
              <div className="stack" style={{ gap: 6 }}>
                <PhotoPicker compact onPicked={async (p) => {
                  // Já abre o ajuste de zoom e posição da foto nova (depois que ela chega no perfil).
                  if (await run(() => repo!.updateDog({ photo: p, avatarCrop: null }), "Foto atualizada.")) setCropOpen(true);
                }} />
                {dog.photoMediaId ? <button type="button" className="btn btn--secondary btn--small" style={{ alignSelf: "flex-start" }} onClick={() => run(() => repo!.updateDog({ photo: null }), "Foto removida.")}>Remover foto</button> : null}
              </div>
            </div>
            {(() => {
              const lv = levelFor(snap.xpTotal);
              return (
                <div className="profile-xp">
                  <span className="profile-xp__num">🐾 {snap.xpTotal} patinhas</span>
                  <span className="small">Nível <strong>{lv.title}</strong>{lv.nextAt ? ` · com mais ${lv.nextAt - snap.xpTotal} patinhas vira “${lv.nextTitle}”` : ""}</span>
                  <span className="caption">As patinhas somam todas as missões de {dog.name}, ficam guardadas para sempre e definem o nível. <Link href="/sobre#niveis">Ver todos os níveis</Link></span>
                </div>
              );
            })()}
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
          {msg ? <p role={msg.kind === "error" ? "alert" : "status"} className={msg.kind === "error" ? "field-error" : "notice notice--positive"}>{msg.text}</p> : null}
          <button type="submit" className="btn btn--primary btn--block" disabled={!dirty}>{dirty ? "Salvar alterações" : "Perfil salvo"}</button>
          </fieldset>
        </form>

        <section className="card stack" aria-labelledby="uso">
          <h2 id="uso">Uso desta versão de teste</h2>
          <dl className="stack small" style={{ margin: 0, gap: 6 }}>
            <div className="row-between"><dt className="muted">Lembranças</dt><dd style={{ margin: 0 }}>{snap.entries.length} de {LIMITS.maxEntries}</dd></div>
            <div className="row-between"><dt className="muted">Tamanho máximo por foto</dt><dd style={{ margin: 0 }}>{LIMITS.maxUploadBytes / 1024 / 1024} MB</dd></div>
          </dl>
          <p className="caption">São limites de teste, não promessas de armazenamento. Nada é apagado ao atingir um limite.</p>
        </section>

        <section className="card stack" aria-labelledby="links">
          <h2 id="links">Links compartilhados</h2>
          <ShareLinksList />
        </section>

        {REAL_MODE ? <FamilySection /> : null}

        <ImportDemoCard />

        {REAL_MODE ? (
          <section className="card stack" aria-labelledby="caes">
            <h2 id="caes">Seus cachorros</h2>
            <DogList />
          </section>
        ) : null}

        {!REAL_MODE || snap.role === "admin" ? (
          <section className="card stack" aria-labelledby="apagar" style={{ borderColor: "#f1c4bf" }}>
            <h2 id="apagar">Apagar o diário de {dog.name}</h2>
            {REAL_MODE ? (
              <p className="small">Apaga o diário de {dog.name} para <strong>toda a família</strong>: fotos, cartinhas, álbuns, conquistas, cuidados, documentos e créditos do Estúdio. Links compartilhados param na hora. Sua conta e seus outros cachorros continuam. Não dá para desfazer.</p>
            ) : (
              <>
                <p className="small">Remove o perfil, todas as fotos, álbuns e conquistas deste aparelho. Não dá para desfazer.</p>
                <div className="notice notice--info"><IconInfo /><span>Nesta demonstração não existe conta em servidor: apagar aqui remove tudo o que existe.</span></div>
              </>
            )}
            <div className="field">
              <label htmlFor="confirm">Para confirmar, digite o nome: <strong>{dog.name}</strong></label>
              <input id="confirm" className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
            </div>
            {deleteError ? <p className="field-error" role="alert">{deleteError}</p> : null}
            <button type="button" className="btn btn--danger-outline btn--block" disabled={confirmText.trim() !== dog.name || deleting} onClick={wipe}>{deleting ? "Apagando…" : `Apagar o diário de ${dog.name}`}</button>
          </section>
        ) : null}
      </main>
    </>
  );
}
