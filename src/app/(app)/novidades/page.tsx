"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { listNotifications, markNotificationsRead, pushState, type Notice, type PushState } from "@/data/push-client";
import { PageLoading, TopBar, useRequireDiary } from "@/components/shell";
import { NotificationSettings } from "@/components/notifications";
import { Sheet } from "@/components/entry-actions";

const when = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
};

/** Novidades da família: fotos, cartinhas e ossinhos de quem participa dos seus diários. */
export default function Novidades() {
  const { ready, snap } = useRequireDiary();
  const { patchSnap } = useStore();
  const router = useRouter();
  const [items, setItems] = useState<Notice[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [push, setPush] = useState<PushState | null>(null);
  const [settings, setSettings] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setItems(null);
    try {
      const list = await listNotifications();
      setItems(list);
      // Marca como lidos SÓ os que apareceram na tela; os que chegarem depois continuam novos.
      const seen = list.filter((n) => !n.read).map((n) => n.id);
      if (seen.length) {
        await markNotificationsRead(seen).catch(() => undefined);
        patchSnap((s) => ({ ...s, unread: Math.max(0, (s.unread ?? 0) - seen.length) }));
      }
    } catch {
      setFailed(true);
    }
  }, [patchSnap]);

  useEffect(() => {
    void load();
    void pushState().then(setPush);
  }, [load]);

  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;

  // O destino (/abrir) confere o acesso e abre o cachorro certo antes da lembrança.
  const open = (n: Notice) => router.push(n.url);

  return (
    <>
      <TopBar title="Novidades" back="/hoje" />
      <main className="main">
        {push === "off" || push === "needs-install" ? (
          <button type="button" className="card row-between profile-row" onClick={() => setSettings(true)}>
            <span className="profile-row__text"><span>🔔 Receber avisos no celular</span><span className="caption">{push === "needs-install" ? "Instale o app na Tela de Início para ligar" : "Quando alguém da família guardar algo"}</span></span>
            <span aria-hidden="true">›</span>
          </button>
        ) : null}

        {failed ? (
          <div className="notice notice--warn stack" role="alert">
            <span>Não conseguimos carregar as novidades.</span>
            <button type="button" className="btn btn--secondary btn--small" onClick={() => void load()}>Tentar novamente</button>
          </div>
        ) : items === null ? <PageLoading /> : items.length === 0 ? (
          <p className="page-note">Quando alguém da família guardar uma foto, escrever uma cartinha ou der um ossinho, aparece aqui.</p>
        ) : (
          <ul className="notice-list" role="list">
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" className={`notice-item${n.read ? "" : " is-new"}`} onClick={() => open(n)}>
                  <span className="notice-item__text">{n.text}</span>
                  <span className="caption">{when(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="btn btn--secondary btn--block" onClick={() => setSettings(true)}>Ajustar avisos</button>
        <Sheet open={settings} onClose={() => { setSettings(false); void pushState().then(setPush); }} labelledBy="avisos-title">
          <h2 id="avisos-title">Avisos da família</h2>
          <NotificationSettings />
          <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={() => { setSettings(false); void pushState().then(setPush); }}>Fechar</button>
        </Sheet>
      </main>
    </>
  );
}
