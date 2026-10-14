"use client";

import { useEffect, useState } from "react";
import type { UserIdentity } from "@supabase/supabase-js";
import { browserClient } from "@/data/supabase-browser";

const NAME: Record<string, string> = { google: "Google", apple: "Apple", email: "Email" };

/**
 * Mais de uma pessoa no mesmo diário: liga o Google/Apple de outra pessoa (ex.: sócia, família) a esta conta.
 * Depois, cada uma entra com a própria conta Google/Apple e vê o mesmo diário.
 */
export function SharedAccess() {
  const [ids, setIds] = useState<UserIdentity[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => browserClient().auth.getUserIdentities().then(({ data }) => setIds(data?.identities ?? [])).catch(() => setIds([]));
  useEffect(() => { void load(); }, []);

  async function add(provider: "google" | "apple") {
    setBusy(provider);
    setMsg(null);
    document.cookie = `ddp_next=${encodeURIComponent("/config#acesso")}; path=/auth; max-age=900; samesite=lax; secure`;
    const { error } = await browserClient().auth.linkIdentity({ provider, options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) {
      setBusy(null);
      setMsg(/already|exists|linked/i.test(error.message) ? "Essa conta já está ligada a outro diário. Ela precisa excluir aquele diário (ou usar outra conta) antes." : "Não deu para ligar agora. Tente de novo.");
    }
  }
  async function remove(identity: UserIdentity) {
    setBusy(identity.identity_id);
    const { error } = await browserClient().auth.unlinkIdentity(identity);
    setBusy(null);
    if (error) setMsg("Não deu para remover. É preciso manter pelo menos uma forma de entrar.");
    else void load();
  }

  return (
    <section className="card stack" id="acesso" aria-labelledby="acesso-titulo">
      <h2 id="acesso-titulo">Quem pode entrar neste diário</h2>
      <p className="small muted">Para dividir o diário com outra pessoa (família, sócia), ligue o Google ou o Apple dela aqui. Ela entra na conta dela nesta tela, e depois consegue abrir o app sozinha e ver tudo deste diário.</p>
      {ids === null ? <p className="caption">Carregando…</p> : (
        <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 6 }}>
          {ids.map((i) => (
            <li key={i.identity_id} className="row-between" style={{ background: "var(--background)", borderRadius: 12, padding: "8px 12px" }}>
              <span className="small"><strong>{NAME[i.provider] ?? i.provider}</strong> · {(i.identity_data?.email as string) ?? "sem email"}</span>
              {ids.length > 1 ? <button type="button" className="btn btn--ghost btn--small" disabled={busy === i.identity_id} onClick={() => remove(i)}>Remover</button> : null}
            </li>
          ))}
        </ul>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn--secondary btn--small" disabled={!!busy} onClick={() => add("google")}>+ Ligar outra conta Google</button>
        <button type="button" className="btn btn--secondary btn--small" disabled={!!busy} onClick={() => add("apple")}>+ Ligar outro Apple ID</button>
      </div>
      {msg ? <p className="field-error" role="alert">{msg}</p> : null}
      <p className="caption">Todas as formas de entrar abrem o mesmo diário e os mesmos créditos. Remova a qualquer momento.</p>
    </section>
  );
}
