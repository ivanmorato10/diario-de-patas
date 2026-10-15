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
import { InstallAppLink } from "@/components/install-app";
import { TimezoneSelect } from "@/components/profile-fields";
import { IconChevron } from "@/components/icons";

const CONFIRM_WORD = "EXCLUIR";

/** Minha conta: tudo o que é da PESSOA — nome, forma de entrar, fuso, indicar o app, sair e excluir a conta. */
export default function Conta() {
  const { snap, repo, reload, reset, unavailable } = useStore();
  const router = useRouter();
  const [account, setAccount] = useState<{ email: string; via: string } | null>(null);
  const [tz, setTz] = useState<string | null>(null);
  const [tzMsg, setTzMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        {REAL_MODE ? (
          <section className="card stack" aria-labelledby="voce">
            <h2 id="voce">Você</h2>
            <MyNameField />
            {account ? <p className="small" style={{ margin: 0 }}>Entra como <strong>{account.email}</strong> (com {account.via}).</p> : null}
          </section>
        ) : null}

        <form className="card stack" onSubmit={saveTz} aria-labelledby="fuso">
          <h2 id="fuso">Fuso horário</h2>
          <TimezoneSelect id="tz" value={tzValue} onChange={(v) => { setTz(v); setTzMsg(null); }} />
          <span className="hint">Organiza as datas das suas lembranças e lembretes.</span>
          {tzMsg ? <p className="small" role="status" style={{ margin: 0 }}>{tzMsg}</p> : null}
          <button type="submit" className="btn btn--secondary btn--block" disabled={!tzDirty}>{tzDirty ? "Salvar fuso" : "Fuso salvo"}</button>
        </form>

        <section className="stack" aria-labelledby="mais">
          <h2 id="mais">Mais</h2>
          {REAL_MODE ? <ShareApp /> : null}
          <Link href="/achadinhos" className="card row-between" style={{ padding: 16 }}><span>🛍️ Achadinhos do Abu</span><IconChevron /></Link>
          <Link href="/sobre" className="card row-between" style={{ padding: 16 }}><span>🐾 Sobre o Diário de Patas</span><IconChevron /></Link>
          <InstallAppLink />
        </section>

        {REAL_MODE ? (
          <>
            <form method="post" action="/auth/sair">
              <button type="submit" className="btn btn--secondary btn--block">Sair da conta</button>
            </form>

            <section className="card stack" aria-labelledby="excluir" style={{ borderColor: "#f1c4bf" }}>
              <h2 id="excluir">Excluir minha conta</h2>
              <p className="small">Exclui a sua conta. Os diários em que você é <strong>responsável e que você criou</strong> são apagados com tudo o que está neles, inclusive para a família convidada. Diários de outras pessoas continuam com elas. Não dá para desfazer.</p>
              <div className="field">
                <label htmlFor="confirm-conta">Para confirmar, digite <strong>{CONFIRM_WORD}</strong></label>
                <input id="confirm-conta" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoCapitalize="characters" />
              </div>
              {error ? <p className="field-error" role="alert">{error}</p> : null}
              <button type="button" className="btn btn--danger-outline btn--block" disabled={confirm.trim().toUpperCase() !== CONFIRM_WORD || busy} onClick={deleteAccount}>{busy ? "Excluindo…" : "Excluir minha conta"}</button>
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}
