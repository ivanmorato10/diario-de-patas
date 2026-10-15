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
import { formatCivilDate, isCivilDate } from "@/domain/dates";
import { Sheet } from "@/components/entry-actions";
import type { DogPreferences } from "@/domain/types";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { PhotoPicker } from "@/components/photo-picker";
import { PreferencesFields } from "@/components/profile-fields";
import { DogAvatar } from "@/components/media";
import { IconChevron, IconTrash } from "@/components/icons";
import { levelFor } from "@/domain/missions";

/**
 * Perfil do cachorro: no topo, quem ele é (foto, nome, aniversário, patinhas); embaixo, linhas que abrem
 * Editar perfil, Família, Preferências das missões e Gerenciar diário. O que é da pessoa fica em Minha conta.
 */
type Panel = "edit" | "family" | "prefs" | "manage" | null;

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
  const [panel, setPanel] = useState<Panel>(null);
  // Link antigo "Família e convites" (/config#familia → /perfil#familia) abre a família direto.
  useEffect(() => { if (window.location.hash === "#familia") setPanel("family"); }, []);

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
  // "Salvar alterações" só aparece quando algo mudou.
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

  const lv = levelFor(snap.xpTotal);
  const close = () => { setPanel(null); setMsg(null); setName(dog.name); setBirth(dog.birthDate ?? ""); setPrefs(dog.preferences); };
  const MsgLine = () => (msg ? <p role={msg.kind === "error" ? "alert" : "status"} className={msg.kind === "error" ? "field-error" : "notice notice--positive"}>{msg.text}</p> : null);
  const Row = ({ id, icon, label, sub }: { id: Panel; icon: string; label: string; sub?: string }) => (
    <button type="button" className="card row-between profile-row" onClick={() => { setMsg(null); setPanel(id); }}>
      <span className="profile-row__text"><span>{icon} {label}</span>{sub ? <span className="caption">{sub}</span> : null}</span>
      <IconChevron />
    </button>
  );

  return (
    <>
      <TopBar title={`Perfil de ${dog.name}`} back="/hoje" />
      <main className="main">
        {dog.photoMediaId && cropOpen ? (
          <AvatarCropSheet open mediaId={dog.photoMediaId} name={dog.name} value={dog.avatarCrop} onClose={() => setCropOpen(false)}
            onPreview={(c) => patchSnap((s) => (s.dog ? { ...s, dog: { ...s.dog, avatarCrop: c } } : s))}
            onSave={(c) => {
              // A foto muda na hora; o servidor grava em seguida (e o reload confirma).
              patchSnap((s) => (s.dog ? { ...s, dog: { ...s.dog, avatarCrop: c } } : s));
              void run(() => repo!.updateDog({ avatarCrop: c }), "Foto ajustada.");
            }} />
        ) : null}

        {/* Quem é o cachorro: foto (tocar ajusta), nome, aniversário, patinhas e nível. */}
        <section className="profile-head" aria-labelledby="perfil">
          {dog.photoMediaId && !viewer ? (
            <button type="button" className="avatar-edit" onClick={() => setCropOpen(true)} aria-label={`Ajustar zoom e posição da foto de ${dog.name}`}>
              <DogAvatar mediaId={dog.photoMediaId} name={dog.name} crop={dog.avatarCrop} size="xl" />
              <span className="avatar-edit__hint" aria-hidden="true">Ajustar</span>
            </button>
          ) : (
            <DogAvatar mediaId={dog.photoMediaId} name={dog.name} crop={dog.avatarCrop} size="xl" />
          )}
          <div className="stack" style={{ gap: 4, minWidth: 0 }}>
            <h2 id="perfil" className="profile-head__name">{dog.name}</h2>
            {dog.birthDate ? <span className="small">🎂 {formatCivilDate(dog.birthDate)}</span> : null}
            <Link href="/sobre#niveis" className="profile-head__xp">🐾 {snap.xpTotal} patinhas · {lv.title}</Link>
          </div>
        </section>
        {msg && !panel ? <MsgLine /> : null}

        <section className="stack" style={{ gap: 8 }} aria-label="Opções do perfil">
          {!viewer ? <Row id="edit" icon="✏️" label="Editar perfil" sub="Foto, nome e aniversário" /> : null}
          {REAL_MODE ? <Row id="family" icon="👨‍👩‍👧" label={`Família de ${dog.name}`} sub={`${snap.members?.length ?? 1} ${(snap.members?.length ?? 1) === 1 ? "pessoa" : "pessoas"}`} /> : null}
          {!viewer ? <Row id="prefs" icon="🎯" label="Preferências das missões" sub="Que tipo de missão combina com vocês" /> : null}
          {!viewer ? <Row id="manage" icon="⚙️" label="Gerenciar diário" sub="Espaço, links compartilhados e apagar" /> : null}
        </section>

        <ImportDemoCard />

        <Sheet open={panel === "edit"} onClose={close} labelledBy="p-edit">
          <h2 id="p-edit">Editar perfil</h2>
          <form className="stack" onSubmit={saveProfile}>
            <div className="stack" style={{ gap: 6 }}>
              <PhotoPicker compact onPicked={async (p) => {
                // Já abre o ajuste de zoom e posição da foto nova (depois que ela chega no perfil).
                if (await run(() => repo!.updateDog({ photo: p, avatarCrop: null }), "Foto atualizada.")) { setPanel(null); setCropOpen(true); }
              }} />
              {dog.photoMediaId ? <button type="button" className="btn btn--secondary btn--small" style={{ alignSelf: "flex-start" }} onClick={() => run(() => repo!.updateDog({ photo: null }), "Foto removida.")}><IconTrash /> Remover foto</button> : null}
            </div>
            <div className="field">
              <label htmlFor="name">Nome</label>
              <input id="name" className="input" value={name} maxLength={LIMITS.dogNameMaxChars} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="birth">Aniversário <span className="muted">(opcional)</span></label>
              <input id="birth" type="date" className="input" value={birth} onChange={(e) => setBirth(e.target.value)} />
            </div>
            <MsgLine />
            {dirty ? <button type="submit" className="btn btn--primary btn--block">Salvar alterações</button> : null}
            <button type="button" className="btn btn--secondary btn--block" onClick={close}>Fechar</button>
          </form>
        </Sheet>

        <Sheet open={panel === "prefs"} onClose={close} labelledBy="p-prefs">
          <h2 id="p-prefs" className="sr-only">Preferências das missões</h2>
          <form className="stack" onSubmit={saveProfile}>
            <PreferencesFields value={prefs} onChange={setPrefs} />
            <MsgLine />
            {dirty ? <button type="submit" className="btn btn--primary btn--block">Salvar alterações</button> : null}
            <button type="button" className="btn btn--secondary btn--block" onClick={close}>Fechar</button>
          </form>
        </Sheet>

        {REAL_MODE ? (
          <Sheet open={panel === "family"} onClose={close} labelledBy="familia-titulo">
            <FamilySection />
            <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={close}>Fechar</button>
          </Sheet>
        ) : null}

        <Sheet open={panel === "manage"} onClose={close} labelledBy="p-manage">
          <h2 id="p-manage">Gerenciar diário</h2>
          <div className="stack">
            <p className="small" style={{ margin: 0 }}>Espaço: <strong>{snap.entries.length} de {LIMITS.maxEntries}</strong> lembranças nesta versão de teste.</p>
            <section className="stack" aria-labelledby="links">
              <h3 id="links">Links compartilhados</h3>
              <ShareLinksList />
            </section>
            {!REAL_MODE || snap.role === "admin" ? (
              <details className="more-details danger-details">
                <summary>Apagar o diário de {dog.name}</summary>
                <div className="stack" style={{ marginTop: 10 }}>
                  {REAL_MODE ? (
                    <p className="small" style={{ margin: 0 }}>Apaga tudo de {dog.name} para <strong>toda a família</strong>: fotos, cartinhas, álbuns, cuidados e créditos. Sua conta e seus outros cachorros continuam. Não dá para desfazer.</p>
                  ) : (
                    <p className="small" style={{ margin: 0 }}>Remove o perfil, as fotos, os álbuns e as conquistas deste aparelho. Não dá para desfazer.</p>
                  )}
                  <div className="field">
                    <label htmlFor="confirm">Para confirmar, digite o nome: <strong>{dog.name}</strong></label>
                    <input id="confirm" className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
                  </div>
                  {deleteError ? <p className="field-error" role="alert">{deleteError}</p> : null}
                  <button type="button" className="btn btn--danger-outline btn--block" disabled={confirmText.trim() !== dog.name || deleting} onClick={wipe}>{deleting ? "Apagando…" : `Apagar o diário de ${dog.name}`}</button>
                </div>
              </details>
            ) : null}
            <button type="button" className="btn btn--secondary btn--block" onClick={close}>Fechar</button>
          </div>
        </Sheet>
      </main>
    </>
  );
}
