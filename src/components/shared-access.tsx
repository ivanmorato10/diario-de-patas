"use client";

import { useEffect, useState } from "react";
import { rpc } from "@/data/real-repository";
import { browserClient } from "@/data/supabase-browser";
import { useStore } from "@/data/store";

/**
 * Compartilhar o diário: gera um código de convite (30 min, uso único). Quem recebe digita na tela de
 * entrada ("Tenho um código de convite") e passa a usar este mesmo diário. Dá para desconectar os outros.
 */
export function SharedAccess() {
  const { snap } = useStore();
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const name = snap?.dog?.name ?? "meu cachorro";

  useEffect(() => {
    if (!code) return;
    const tick = () => setLeft(Math.max(0, Date.parse(code.expiresAt) - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [code]);

  async function generate() {
    setBusy(true);
    setMsg(null);
    try { setCode(await rpc("createAccessCode")); } catch { setMsg("Não deu para gerar o código. Tente de novo."); } finally { setBusy(false); }
  }
  async function copy() {
    if (!code) return;
    try { await navigator.clipboard.writeText(code.code); setMsg("Código copiado."); } catch { setMsg(code.code); }
  }
  async function others() {
    setBusy(true);
    const { error } = await browserClient().auth.signOut({ scope: "others" });
    setBusy(false);
    setMsg(error ? "Não deu para desconectar agora." : "Pronto: os outros aparelhos saíram do diário. Este continua conectado.");
  }

  const site = typeof window !== "undefined" ? window.location.origin : "";
  const text = code ? `Oi! Use este código para entrar no diário de ${name} no Diário de Patas: ${code.code}\nAbra ${site}, toque em "Tenho um código de convite" e digite o código (vale por 30 minutos).` : "";
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);

  return (
    <section className="card stack" id="acesso" aria-labelledby="acesso-titulo">
      <h2 id="acesso-titulo">Compartilhar o diário</h2>
      <p className="small muted">Para outra pessoa (família, sócia) usar este mesmo diário no celular dela: gere um código e mande para ela. Ela toca em “Tenho um código de convite” na tela de entrada e digita. Fotos, missões, cuidados e créditos ficam compartilhados.</p>
      {code && left > 0 ? (
        <div className="invite-code">
          <span className="invite-code__label">Código de convite</span>
          <strong className="invite-code__value">{code.code}</strong>
          <span className="caption">Vale por {mm}:{String(ss).padStart(2, "0")} e só pode ser usado uma vez.</span>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <a className="btn btn--primary btn--small" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener">Enviar pelo WhatsApp</a>
            <button type="button" className="btn btn--secondary btn--small" onClick={copy}>Copiar código</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={generate}>{busy ? "Gerando…" : code ? "Gerar outro código" : "Gerar código de convite"}</button>
      )}
      <p className="caption">Quem entra com o código tem acesso completo ao diário (inclusive Ajustes). Compartilhe só com quem você confia.</p>
      <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={others}>Desconectar outros aparelhos</button>
      {msg ? <p className="small" role="status">{msg}</p> : null}
    </section>
  );
}
