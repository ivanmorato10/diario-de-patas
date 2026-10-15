"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { switchDog } from "@/data/family-client";
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
  const { reload, patchSnap } = useStore();
  const router = useRouter();
  const [items, setItems] = useState<Notice[] | null>(null);
  const [push, setPush] = useState<PushState | null>(null);
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    void listNotifications().then(setItems).catch(() => setItems([]));
    void pushState().then(setPush);
    // Abrir as novidades zera o sininho.
    void markNotificationsRead().then(() => patchSnap((s) => ({ ...s, unread: 0 }))).catch(() => undefined);
  }, [patchSnap]);

  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;

  async function open(n: Notice) {
    if (n.dogId !== snap!.dog!.id) { await switchDog(n.dogId).catch(() => undefined); await reload(); }
    router.push(n.url);
  }

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

        {items === null ? <PageLoading /> : items.length === 0 ? (
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
