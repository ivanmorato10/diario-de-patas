"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useCatalog } from "@/i18n/catalog";
import { useFormat } from "@/i18n/use-format";
import { useErrorText } from "@/i18n/use-error";
import { useStore } from "@/data/store";
import { DomainError } from "@/data/demo-repository";
import { LIMITS, fullDiaryParams } from "@/config/business";
import { rpc, setActiveDog } from "@/data/real-repository";
import type { Dog } from "@/domain/types";
import { ShareLinksList } from "@/components/share";
import { ImportDemoCard } from "@/components/import-demo";
import { AvatarCropSheet } from "@/components/avatar-crop";
import { FamilySection } from "@/components/family-section";
import { isCivilDate } from "@/domain/dates";
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
  const { repo, reload, patchSnap, patchDog } = useStore();
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [nick, setNick] = useState("");
  const [prefs, setPrefs] = useState<DogPreferences | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState<"save" | "photo" | null>(null); // o que está gravando (o botão tocado mostra)
  const [confirmText, setConfirmText] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [askSave, setAskSave] = useState(false);
  const t = useTranslations("profile");
  const te = useTranslations("errors");
  const cat = useCatalog(snap?.dog?.name ?? "");
  const f = useFormat();
  const errText = useErrorText();
  // Link antigo "Família e convites" (/config#familia → /perfil#familia) abre a família direto.
  useEffect(() => { if (window.location.hash === "#familia") setPanel("family"); }, []);

  // O formulário é do cachorro aberto: ao trocar de cachorro, recarrega (nunca reaproveita o anterior).
  const [formFor, setFormFor] = useState<string | null>(null);
  useEffect(() => {
    if (snap?.dog && (prefs === null || formFor !== snap.dog.id)) {
      setFormFor(snap.dog.id);
      setName(snap.dog.name);
      setBirth(snap.dog.birthDate ?? "");
      setNick(snap.dog.nickname ?? "");
      setPrefs(snap.dog.preferences);
    }
  }, [snap, prefs, formFor]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog || !prefs || !repo) return <main className="main"><PageLoading /></main>;
  const dog = snap.dog;
  const viewer = snap.role === "viewer";
  // "Salvar alterações" só aparece quando algo mudou.
  const dirty = name.trim() !== dog.name || nick.trim() !== (dog.nickname ?? "") || birth !== (dog.birthDate ?? "") || JSON.stringify(prefs) !== JSON.stringify(dog.preferences);

  /**
   * Gravar e conferir são separados: o cachorro salvo (devolvido pelo servidor) entra na tela na hora e o "salvo"
   * aparece; a recarga completa vem depois e, se falhar, não vira erro de gravação.
   */
  async function run(fn: () => Promise<unknown>, ok: string, which: "save" | "photo" = "save") {
    if (saving) return false; // um toque por vez
    setSaving(which);
    setMsg(null);
    const dogAtStart = snap?.dog?.id;
    let saved: unknown;
    try {
      saved = await fn();
    } catch (e) {
      setMsg({ kind: "error", text: errText(e instanceof DomainError ? e : null, "errors.saveFailed") });
      setSaving(null);
      return false;
    }
    setSaving(null);
    const d = saved && typeof saved === "object" && "id" in saved ? (saved as Dog) : null;
    if (d) patchDog(dogAtStart, (s) => ({ ...s, dog: s.dog ? { ...s.dog, ...d } : s.dog, diaries: s.diaries?.map((x) => (x.id === d.id ? { ...x, name: d.name, photoMediaId: d.photoMediaId, avatarCrop: d.avatarCrop ?? null } : x)) }));
    setMsg({ kind: "ok", text: ok });
    void reload().catch(() => undefined);
    return true;
  }

  async function saveProfile(e?: React.FormEvent) {
    e?.preventDefault();
    if (birth && !isCivilDate(birth)) { setAskSave(false); setMsg({ kind: "error", text: errText("validation.invalidDate") }); return false; }
    // Se falhar, os campos continuam preenchidos e o erro aparece na janela.
    const ok = await run(() => repo!.updateDog({ name, nickname: nick.trim() || null, birthDate: birth || null, preferences: prefs! }), t("saved"));
    if (!ok) setAskSave(false);
    return ok;
  }
  const SaveAsk = () => askSave ? (
    <div className="save-ask" role="alertdialog" aria-label={t("askSave")}>
      <strong>{t("askSave")}</strong>
      <div className="stack" style={{ gap: 8 }}>
        <button type="button" className="btn btn--primary btn--block" disabled={!!saving} aria-busy={saving === "save" ? "true" : undefined} onClick={async () => { if (await saveProfile()) close(); }}>{saving === "save" ? t("saving") : t("save")}</button>
        <button type="button" className="btn btn--secondary btn--block" onClick={close}>{t("discard")}</button>
        <button type="button" className="btn btn--secondary btn--block" onClick={() => setAskSave(false)}>{t("keepEditing")}</button>
      </div>
    </div>
  ) : null;

  async function wipe() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await rpc("deleteDiary", { confirmName: confirmText.trim() });
    } catch (e) {
      setDeleteError(errText(e instanceof Error ? e.message : "profile.deleteFailed"));
      setDeleting(false);
      return;
    }
    // Apagou: abre o app do zero (vai para o diário que restou ou para "adicionar cachorro"), sem depender de recarga.
    setActiveDog(null);
    window.location.assign("/");
  }


  const lv = levelFor(snap.xpTotal);
  // Fechar com alterações pendentes pergunta antes (Fechar, toque fora, Esc); sem alterações, fecha direto.
  const tryClose = () => { if (dirty) setAskSave(true); else close(); };
  // Fechar/descartar: o formulário volta a ser carregado do perfil atual (já salvo ou não).
  const close = () => { setAskSave(false); setPanel(null); setMsg(null); setFormFor(null); };
  const MsgLine = () => (msg ? <p role={msg.kind === "error" ? "alert" : "status"} className={msg.kind === "error" ? "field-error" : "notice notice--positive"}>{msg.text}</p> : null);
  const Row = ({ id, icon, label, sub }: { id: Panel; icon: string; label: string; sub?: string }) => (
    <button type="button" className="card row-between profile-row" onClick={() => { setMsg(null); setPanel(id); }}>
      <span className="profile-row__text"><span>{icon} {label}</span>{sub ? <span className="caption">{sub}</span> : null}</span>
      <IconChevron />
    </button>
  );

  return (
    <>
      <TopBar title={t("title", { dog: dog.name })} back="/hoje" emoji="🐶" />
      <main className="main">
        {dog.photoMediaId && cropOpen ? (
          <AvatarCropSheet open mediaId={dog.photoMediaId} name={dog.name} value={dog.avatarCrop} onClose={() => setCropOpen(false)}
            onPreview={(c) => patchSnap((s) => (s.dog ? { ...s, dog: { ...s.dog, avatarCrop: c } } : s))}
            onSave={(c) => {
              // A foto muda na hora; o servidor grava em seguida (e o reload confirma).
              patchSnap((s) => (s.dog ? { ...s, dog: { ...s.dog, avatarCrop: c } } : s));
              void run(() => repo!.updateDog({ avatarCrop: c }), t("photoAdjusted"));
            }} />
        ) : null}

        {/* Quem é o cachorro: foto (tocar ajusta), nome, aniversário, patinhas e nível. */}
        <section className="profile-head" aria-labelledby="perfil">
          {dog.photoMediaId && !viewer ? (
            <button type="button" className="avatar-edit" onClick={() => setCropOpen(true)} aria-label={t("adjustLabel", { dog: dog.name })}>
              <DogAvatar mediaId={dog.photoMediaId} name={dog.name} crop={dog.avatarCrop} size="xl" />
              <span className="avatar-edit__hint" aria-hidden="true">{t("adjust")}</span>
            </button>
          ) : (
            <DogAvatar mediaId={dog.photoMediaId} name={dog.name} crop={dog.avatarCrop} size="xl" />
          )}
          <div className="stack" style={{ gap: 4, minWidth: 0 }}>
            <h2 id="perfil" className="profile-head__name">{dog.name}</h2>
            {dog.nickname ? <span className="profile-head__nick">“{dog.nickname}”</span> : null}
            {dog.birthDate ? <span className="small">🎂 {f.date(dog.birthDate)}</span> : null}
            <Link href="/sobre#niveis" className="profile-head__xp">🐾 {t("paws", { count: snap.xpTotal })} · {cat.level(lv)}</Link>
          </div>
        </section>
        {msg && !panel ? <MsgLine /> : null}

        <section className="stack" style={{ gap: 8 }} aria-label={t("options")}>
          {!viewer ? <Row id="edit" icon="✏️" label={t("edit")} sub={t("editSub")} /> : null}
          <Row id="family" icon="👨‍👩‍👧" label={t("family", { dog: dog.name })} sub={t("people", { count: snap.members?.length ?? 1 })} />
          {!viewer ? <Row id="prefs" icon="🎯" label={t("prefs")} sub={t("prefsSub")} /> : null}
          {!viewer ? <Row id="manage" icon="⚙️" label={t("manage")} sub={t("manageSub")} /> : null}
        </section>

        <ImportDemoCard />

        <Sheet open={panel === "edit"} onClose={close} onAttemptClose={tryClose} labelledBy="p-edit">
          <h2 id="p-edit">{t("edit")}</h2>
          <form className="stack" onSubmit={saveProfile}>
            <div className="stack" style={{ gap: 6 }}>
              <PhotoPicker compact onPicked={async (p) => {
                // Já abre o ajuste de zoom e posição da foto nova (depois que ela chega no perfil).
                if (await run(() => repo!.updateDog({ photo: p, avatarCrop: null }), t("photoUpdated"))) { setPanel(null); setCropOpen(true); }
              }} />
              {dog.photoMediaId ? <button type="button" className="btn btn--secondary btn--small" style={{ alignSelf: "flex-start" }} disabled={!!saving} aria-busy={saving === "photo" ? "true" : undefined} onClick={() => run(() => repo!.updateDog({ photo: null }), t("photoRemoved"), "photo")}>{saving === "photo" ? null : <IconTrash />} {t("removePhoto")}</button> : null}
            </div>
            <div className="field">
              <label htmlFor="name">{t("name")}</label>
              <input id="name" className="input" value={name} maxLength={LIMITS.dogNameMaxChars} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="nick">{t("nick")} <span className="muted">{t("optional")}</span></label>
              <input id="nick" className="input" value={nick} maxLength={30} placeholder={t("nickPlaceholder")} onChange={(e) => setNick(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="birth">{t("birthday")} <span className="muted">{t("optional")}</span></label>
              <input id="birth" type="date" className="input" value={birth} onChange={(e) => setBirth(e.target.value)} />
            </div>
            <MsgLine />
            <SaveAsk />
            {dirty && !askSave ? <button type="submit" className="btn btn--primary btn--block" disabled={!!saving} aria-busy={saving === "save" ? "true" : undefined}>{saving === "save" ? t("saving") : t("saveChanges")}</button> : null}
            {!askSave ? <button type="button" className="btn btn--secondary btn--block" onClick={tryClose}>{t("close")}</button> : null}
          </form>
        </Sheet>

        <Sheet open={panel === "prefs"} onClose={close} onAttemptClose={tryClose} labelledBy="p-prefs">
          <h2 id="p-prefs" className="sr-only">{t("prefs")}</h2>
          <form className="stack" onSubmit={saveProfile}>
            <PreferencesFields value={prefs} onChange={setPrefs} />
            <MsgLine />
            <SaveAsk />
            {dirty && !askSave ? <button type="submit" className="btn btn--primary btn--block" disabled={!!saving} aria-busy={saving === "save" ? "true" : undefined}>{saving === "save" ? t("saving") : t("saveChanges")}</button> : null}
            {!askSave ? <button type="button" className="btn btn--secondary btn--block" onClick={tryClose}>{t("close")}</button> : null}
          </form>
        </Sheet>

        <Sheet open={panel === "family"} onClose={close} labelledBy="familia-titulo">
          <FamilySection />
          <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={close}>{t("close")}</button>
        </Sheet>

        <Sheet open={panel === "manage"} onClose={close} labelledBy="p-manage">
          <h2 id="p-manage">{t("manage")}</h2>
          <div className="stack">
            <p className="small" style={{ margin: 0 }}>{t.rich("space", { n: snap.entries.length, max: LIMITS.maxEntries, strong: (c) => <strong>{c}</strong> })}</p>
            {snap.entries.length >= LIMITS.maxEntries ? <p className="notice notice--warn small" style={{ margin: 0 }}><span>{te("fullDiary", fullDiaryParams(dog.name))}</span></p> : null}
            <section className="stack" aria-labelledby="links">
              <h3 id="links">{t("links")}</h3>
              <ShareLinksList />
            </section>
            {snap.role === "admin" ? (
              <details className="more-details danger-details">
                <summary>{t("deleteDiary", { dog: dog.name })}</summary>
                <div className="stack" style={{ marginTop: 10 }}>
                  <p className="small" style={{ margin: 0 }}>{t.rich("deleteText", { dog: dog.name, strong: (c) => <strong>{c}</strong> })}</p>
                  <div className="field">
                    <label htmlFor="confirm">{t.rich("confirmLabel", { dog: dog.name, strong: (c) => <strong>{c}</strong> })}</label>
                    <input id="confirm" className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
                  </div>
                  {deleteError ? <p className="field-error" role="alert">{deleteError}</p> : null}
                  <button type="button" className="btn btn--danger-outline btn--block" disabled={confirmText.trim() !== dog.name || deleting} aria-busy={deleting ? "true" : undefined} onClick={wipe}>{deleting ? t("deleting") : t("deleteDiary", { dog: dog.name })}</button>
                </div>
              </details>
            ) : null}
            <button type="button" className="btn btn--secondary btn--block" onClick={close}>{t("close")}</button>
          </div>
        </Sheet>
      </main>
    </>
  );
}
