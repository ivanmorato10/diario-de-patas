"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { REAL_MODE } from "@/config/mode";
import { browserClient } from "@/data/supabase-browser";
import { isValidTimezone } from "@/domain/dates";
import { PageLoading, StorageUnavailable, TopBar } from "@/components/shell";
import { MyNameField } from "@/components/name-ask";
import { ShareApp } from "@/components/share-app";
import { FamilyDiaries } from "@/components/family-diaries";
import { NotificationSettings } from "@/components/notifications";
import { InstallAppLink } from "@/components/install-app";
import { TimezoneSelect } from "@/components/profile-fields";
import { IconChevron } from "@/components/icons";
import { Sheet } from "@/components/entry-actions";

const CONFIRM_WORD = "EXCLUIR";
type Panel = "name" | "family" | "notify" | "tz" | "delete" | null;

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

  useEffect(() => {
    if (!REAL_MODE) return;
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
    if (!isValidTimezone(tzValue)) return setTzMsg("Fuso horário inválido.");
    try {
      await repo!.updateTimezone(tzValue);
      await reload();
      setTz(null);
      setTzMsg("Fuso salvo.");
    } catch {
      setTzMsg("Não deu para salvar agora.");
    }
  }

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      await reset(); // exclui no servidor e limpa as fotos guardadas neste aparelho
      router.replace("/entrar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para excluir agora.");
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="Minha conta" back="/hoje" />
      <main className="main">
        {/* Quem é você: nome e forma de entrar; embaixo, linhas que abrem cada ajuste. */}
        {REAL_MODE ? (
          <section className="profile-head" aria-labelledby="voce">
            <span className="account-avatar" aria-hidden="true">{(snap.me?.name || "?")[0].toUpperCase()}</span>
            <div className="stack" style={{ gap: 2, minWidth: 0 }}>
              <h2 id="voce" className="profile-head__name">{snap.me?.nameConfirmed ? snap.me.name : "Você"}</h2>
              {account ? <><span className="small" style={{ overflowWrap: "anywhere" }}>{account.email}</span><span className="caption">entra com {account.via}</span></> : null}
            </div>
          </section>
        ) : null}

        <section className="stack" style={{ gap: 8 }} aria-label="Ajustes da conta">
          {REAL_MODE ? <Row id="name" icon="✏️" label="Seu nome" sub={snap.me?.nameConfirmed ? `A família vê “${snap.me.name}”` : "Como você aparece para a família"} /> : null}
          {REAL_MODE && others > 0 ? <Row id="family" icon="👨‍👩‍👧" label="Diários da família" sub={`${others} ${others === 1 ? "diário de outra pessoa" : "diários de outras pessoas"}`} /> : null}
          {REAL_MODE ? <Row id="notify" icon="🔔" label="Notificações" sub="Avisos da família no celular" /> : null}
          <Row id="tz" icon="🕐" label="Fuso horário" sub={tzValue.replace(/_/g, " ")} />
          {REAL_MODE ? <ShareApp /> : null}
          <Link href="/achadinhos" className="card row-between profile-row"><span className="profile-row__text"><span>🛍️ Achadinhos do Abu</span></span><IconChevron /></Link>
          <Link href="/sobre" className="card row-between profile-row"><span className="profile-row__text"><span>🐾 Sobre o Diário de Patas</span></span><IconChevron /></Link>
          <InstallAppLink variant="row" />
          {REAL_MODE ? (
            <form method="post" action="/auth/sair" style={{ display: "contents" }}>
              <button type="submit" className="card row-between profile-row"><span className="profile-row__text"><span>🚪 Sair da conta</span></span><IconChevron /></button>
            </form>
          ) : null}
          {REAL_MODE ? <Row id="delete" icon="🗑️" label="Excluir minha conta" /> : null}
        </section>

        <Sheet open={panel === "name"} onClose={() => setPanel(null)} labelledBy="c-name">
          <h2 id="c-name">Seu nome</h2>
          <MyNameField />
          <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={() => setPanel(null)}>Fechar</button>
        </Sheet>

        <Sheet open={panel === "family"} onClose={() => setPanel(null)} labelledBy="familias">
          <FamilyDiaries />
          <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={() => setPanel(null)}>Fechar</button>
        </Sheet>

        <Sheet open={panel === "notify"} onClose={() => setPanel(null)} labelledBy="c-notify">
          <h2 id="c-notify">Notificações</h2>
          <NotificationSettings />
          <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={() => setPanel(null)}>Fechar</button>
        </Sheet>

        <Sheet open={panel === "tz"} onClose={() => { setPanel(null); setTz(null); setTzMsg(null); }} labelledBy="fuso">
          <form className="stack" onSubmit={saveTz}>
            <h2 id="fuso">Fuso horário</h2>
            <TimezoneSelect id="tz" value={tzValue} onChange={(v) => { setTz(v); setTzMsg(null); }} />
            <span className="hint">Organiza as datas das suas lembranças e lembretes.</span>
            {tzMsg ? <p className="small" role="status" style={{ margin: 0 }}>{tzMsg}</p> : null}
            {tzDirty ? <button type="submit" className="btn btn--primary btn--block">Salvar fuso</button> : null}
            <button type="button" className="btn btn--secondary btn--block" onClick={() => { setPanel(null); setTz(null); setTzMsg(null); }}>Fechar</button>
          </form>
        </Sheet>

        <Sheet open={panel === "delete"} onClose={() => setPanel(null)} labelledBy="excluir">
          <h2 id="excluir">Excluir minha conta</h2>
          <p className="small">Os diários que você criou são apagados com tudo o que está neles, inclusive para a família convidada. Diários de outras pessoas continuam com elas. Não dá para desfazer.</p>
          <div className="field">
            <label htmlFor="confirm-conta">Para confirmar, digite <strong>{CONFIRM_WORD}</strong></label>
            <input id="confirm-conta" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoCapitalize="characters" />
          </div>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <div className="stack" style={{ gap: 8 }}>
            <button type="button" className="btn btn--danger-outline btn--block" disabled={confirm.trim().toUpperCase() !== CONFIRM_WORD || busy} onClick={deleteAccount}>{busy ? "Excluindo…" : "Excluir minha conta"}</button>
            <button type="button" className="btn btn--secondary btn--block" onClick={() => setPanel(null)}>Fechar</button>
          </div>
        </Sheet>
      </main>
    </>
  );
}
