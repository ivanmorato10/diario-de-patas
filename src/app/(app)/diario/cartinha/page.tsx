"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { NameAsk } from "@/components/name-ask";
import { useStore } from "@/data/store";
import { deleteLetter, saveLetter, updateLetter } from "@/data/letters-client";

const MAX = 3000;

/** Escrever (ou editar) uma cartinha para o cachorro: folha de carta, data e assinatura com o nome da pessoa. */
function Cartinha() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { reload } = useStore();
  const router = useRouter();
  const id = useSearchParams().get("id");
  const editing = id ? snap?.letters?.find((l) => l.id === id) ?? null : null;
  const [body, setBody] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string>("");
  const loaded = useRef(false);

  useEffect(() => {
    if (!snap || loaded.current) return;
    loaded.current = true;
    key.current = crypto.randomUUID();
    setDate(editing?.date ?? snap.today);
    setBody(editing?.body ?? "");
  }, [snap, editing]);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;
  const dog = snap.dog;
  if (snap.role === "viewer") return (<><TopBar title="Cartinha" back="/diario" /><main className="main"><p className="page-note">Você pode só ver o diário de {dog.name}. Para escrever cartinhas, peça para o administrador mudar seu papel para “Pode editar”.</p></main></>);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return setError("Escreva alguma coisa para " + dog.name + ".");
    setBusy(true);
    setError(null);
    try {
      const res = editing ? (await updateLetter({ id: editing.id, body, date }), { id: editing.id }) : await saveLetter({ requestKey: key.current, body, date });
      await reload();
      router.replace(`/diario#carta-${res.id}`);
    } catch (er) {
      setError(er instanceof Error ? er.message : "Não deu para guardar a cartinha agora.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing || !window.confirm("Apagar esta cartinha? Não dá para desfazer.")) return;
    setBusy(true);
    try {
      await deleteLetter(editing.id);
      await reload();
      router.replace("/diario");
    } catch (er) {
      setError(er instanceof Error ? er.message : "Não deu para apagar agora.");
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="Cartinha" back="/diario" />
      <main className="main">
        <NameAsk title="Antes: como a família te chama?" note="A cartinha sai assinada com esse nome." />
        <form className="stack" onSubmit={save}>
          <div className="letter-card letter-card--edit">
            <p className="letter-card__kicker">💌 {editing ? "Editar cartinha" : "Nova cartinha"}</p>
            <p className="letter-card__hello">Querido {dog.name},</p>
            <label htmlFor="carta" className="sr-only">Sua cartinha para {dog.name}</label>
            <textarea id="carta" className="letter-card__body letter-card__input" value={body} maxLength={MAX} rows={8} autoFocus={!editing}
              placeholder={`Hoje você…`} onChange={(e) => setBody(e.target.value)} />
            <p className="letter-card__sign">— {snap.me?.name ?? "Você"}</p>
          </div>
          <div className="row-between" style={{ alignItems: "end", gap: 12 }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="data-carta">Data</label>
              <input id="data-carta" type="date" className="input" value={date} max={snap.today} onChange={(e) => setDate(e.target.value)} />
            </div>
            <span className="caption">{body.length}/{MAX}</span>
          </div>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{busy ? "Guardando…" : editing ? "Salvar cartinha" : "Guardar cartinha"}</button>
          {editing ? <button type="button" className="btn btn--secondary btn--block" onClick={remove} disabled={busy}>Apagar cartinha</button> : null}
        </form>
      </main>
    </>
  );
}

export default function CartinhaPage() {
  return (
    <Suspense fallback={null}>
      <Cartinha />
    </Suspense>
  );
}
