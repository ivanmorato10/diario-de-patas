"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { ROLE_PT } from "@/data/family-client";
import { rpc } from "@/data/real-repository";
import { DogAvatar } from "./media";

/** Minha conta: diários de outras pessoas em que você participa, com "Sair" (inclusive para quem só acompanha). */
export function FamilyDiaries() {
  const { snap, reload } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const others = (snap?.diaries ?? []).filter((d) => !d.mine);
  if (!others.length) return null;

  async function leave(id: string, name: string) {
    if (!window.confirm(`Sair do diário de ${name}? Você deixa de ver as fotos e cartinhas. Para voltar, precisa de um novo convite.`)) return;
    setBusy(id);
    setMsg(null);
    try {
      await rpc("leaveDiary", { dogId: id });
      // Sem nenhum cachorro: volta para "Qual é o seu caso?" (cadastrar um ou usar um convite).
      await reload();
      if ((snap?.diaries?.length ?? 0) <= 1) return router.replace("/");
      setMsg(`Você saiu do diário de ${name}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não deu para sair agora.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card stack" aria-labelledby="familias">
      <h2 id="familias">Diários da família que você participa</h2>
      <ul className="dog-list" role="list" style={{ margin: 0 }}>
        {others.map((d) => (
          <li key={d.id} className="dog-list__row">
            <div className="dog-list__item" style={{ cursor: "default" }}>
              <DogAvatar mediaId={d.photoMediaId} name={d.name} crop={d.avatarCrop} />
              <span className="dog-list__text"><strong>{d.name}</strong><span className="caption">{ROLE_PT[d.role]}</span></span>
            </div>
            <button type="button" className="btn btn--secondary btn--small" style={{ alignSelf: "center" }} disabled={!!busy} onClick={() => leave(d.id, d.name)}>{busy === d.id ? "Saindo…" : "Sair"}</button>
          </li>
        ))}
      </ul>
      {msg ? <p className="small" role="status" style={{ margin: 0 }}>{msg}</p> : null}
    </section>
  );
}
