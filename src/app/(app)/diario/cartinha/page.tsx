"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/i18n/use-error";
import { useRouter, useSearchParams } from "next/navigation";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { NameAsk } from "@/components/name-ask";
import { useStore } from "@/data/store";
import { deleteLetter, saveLetter, updateLetter } from "@/data/letters-client";

const MAX = 3000;

/** Escrever (ou editar) uma cartinha para o cachorro: folha de carta, data e assinatura com o nome da pessoa. */
function Cartinha() {
  const { ready, snap, unavailable } = useRequireDiary();
  const { reload, patchDog } = useStore();
  const router = useRouter();
  const id = useSearchParams().get("id");
  const editing = id ? snap?.letters?.find((l) => l.id === id) ?? null : null;
  const [body, setBody] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("letterEdit");
  const tf = useTranslations("family");
  const errText = useErrorText();
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
  if (snap.role === "viewer") return (<><TopBar title={t("title")} back="/diario" emoji="💌" /><main className="main"><p className="page-note">{t("viewer", { dog: dog.name, role: tf("roles.editor") })}</p></main></>);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return setError(t("empty", { dog: dog.name }));
    setBusy(true);
    setError(null);
    const dogAtStart = dog.id;
    let res: { id: string };
    try {
      res = editing ? (await updateLetter({ id: editing.id, body, date }), { id: editing.id }) : await saveLetter({ requestKey: key.current, body, date });
    } catch (er) {
      setError(errText(er, "errors.letterSaveFailed"));
      setBusy(false);
      return;
    }
    // Gravou: a cartinha entra no Diário na hora; a conferência completa vem depois (se falhar, não vira erro).
    const me = snap!.me;
    patchDog(dogAtStart, (s) => {
      const letters = s.letters ?? [];
      const prev = letters.find((l) => l.id === res.id);
      const letter = prev ? { ...prev, body: body.trim(), date } : { id: res.id, body: body.trim(), date, createdBy: me?.userId ?? null, createdByName: null, mine: true, createdAt: new Date().toISOString() };
      return { ...s, letters: [letter, ...letters.filter((l) => l.id !== res.id)].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)) };
    });
    void reload().catch(() => undefined);
    router.replace(`/diario#carta-${res.id}`);
  }

  async function remove() {
    if (!editing || !window.confirm(t("confirmDelete"))) return;
    setBusy(true);
    const id = editing.id;
    try {
      await deleteLetter(id);
    } catch (er) {
      setError(errText(er, "letterEdit.deleteFailed"));
      setBusy(false);
      return;
    }
    patchDog(dog.id, (s) => ({ ...s, letters: (s.letters ?? []).filter((l) => l.id !== id), bones: (s.bones ?? []).filter((b) => !(b.targetType === "letter" && b.targetId === id)) }));
    void reload().catch(() => undefined);
    router.replace("/diario");
  }

  return (
    <>
      <TopBar title={t("title")} back="/diario" emoji="💌" />
      <main className="main">
        <NameAsk title={t("nameTitle")} note={t("nameNote")} />
        <form className="stack" onSubmit={save}>
          <div className="letter-card letter-card--edit">
            <p className="letter-card__kicker">💌 {editing ? t("editKicker") : t("newKicker")}</p>
            <p className="letter-card__hello">{t("hello", { dog: dog.name })}</p>
            <label htmlFor="carta" className="sr-only">{t("label", { dog: dog.name })}</label>
            <textarea id="carta" className="letter-card__body letter-card__input" value={body} maxLength={MAX} rows={8} autoFocus={!editing}
              placeholder={t("placeholder")} onChange={(e) => setBody(e.target.value)} />
            <p className="letter-card__sign">— {snap.me?.nameConfirmed ? snap.me.name : t("yourName")}</p>
          </div>
          <div className="row-between" style={{ alignItems: "end", gap: 12 }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="data-carta">{t("date")}</label>
              <input id="data-carta" type="date" className="input" value={date} max={snap.today} onChange={(e) => setDate(e.target.value)} />
            </div>
            <span className="caption">{body.length}/{MAX}</span>
          </div>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy} aria-busy={busy ? "true" : undefined}>{busy ? t("saving") : editing ? t("saveEdit") : t("save")}</button>
          {editing ? <button type="button" className="btn btn--secondary btn--block" onClick={remove} disabled={busy}>{t("delete")}</button> : null}
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
