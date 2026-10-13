"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { STUDIO_THEMES, type StudioTheme } from "@/config/catalog";
import { CREDITS, FLAGS } from "@/config/business";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { MediaImage } from "@/components/media";
import { IconBrush, IconInfo } from "@/components/icons";

/** Vinhetas decorativas do tema — NÃO são prévias do resultado (§21). */
function ThemeVignette({ id }: { id: StudioTheme["id"] }) {
  const common = { width: "100%", height: 84, viewBox: "0 0 160 84", "aria-hidden": true } as const;
  if (id === "aniversario")
    return (<svg {...common}><rect width="160" height="84" rx="14" fill="#F9E7DE" /><rect x="58" y="44" width="44" height="26" rx="6" fill="#C65D3B" /><rect x="58" y="44" width="44" height="7" fill="#E8B84A" /><rect x="78" y="32" width="4" height="12" fill="#285943" /><circle cx="80" cy="29" r="3" fill="#E8B84A" /><circle cx="30" cy="30" r="10" fill="#A6BBA6" /><circle cx="132" cy="26" r="9" fill="#E8B84A" /><path d="M30 40v22M132 35v25" stroke="#59665F" /></svg>);
  if (id === "halloween")
    return (<svg {...common}><rect width="160" height="84" rx="14" fill="#E5EFE7" /><ellipse cx="80" cy="54" rx="26" ry="20" fill="#C65D3B" /><path d="M66 38c4 6 4 26 0 34M94 38c-4 6-4 26 0 34" stroke="#A5482A" strokeWidth="2" fill="none" /><rect x="77" y="28" width="6" height="10" rx="2" fill="#285943" /><circle cx="128" cy="24" r="10" fill="#E8B84A" /></svg>);
  return (<svg {...common}><rect width="160" height="84" rx="14" fill="#E5EFE7" /><path d="M80 12 104 66H56Z" fill="#285943" /><rect x="76" y="66" width="8" height="8" fill="#59665F" /><circle cx="72" cy="40" r="3" fill="#E8B84A" /><circle cx="88" cy="52" r="3" fill="#C65D3B" /><circle cx="80" cy="28" r="3" fill="#E8B84A" /><path d="M20 70h30M110 70h30" stroke="#A6BBA6" strokeWidth="4" strokeLinecap="round" /></svg>);
}

export default function EstudioPage() {
  return (
    <Suspense fallback={<main className="main"><PageLoading /></main>}>
      <Estudio />
    </Suspense>
  );
}

function Estudio() {
  const { ready, snap, unavailable } = useRequireDiary();
  // Vindo de uma missão especial (“Transformar em arte de Natal?”, §7.6): tema e foto já escolhidos.
  const params = useSearchParams();
  const presetTheme = STUDIO_THEMES.find((t) => t.id === params.get("tema"))?.id ?? null;
  const [photoId, setPhotoId] = useState<string | null>(params.get("entrada"));
  const [theme, setTheme] = useState<StudioTheme["id"] | null>(presetTheme);

  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;
  const photos = snap.entries.filter((e) => e.source !== "studio");
  const balance = 0; // sem provedor e sem pagamentos: nenhum crédito real existe ainda
  const providerConfigured = false;

  return (
    <>
      <TopBar title="Estúdio" />
      <main className="main">
        <div className="stack">
          <h1>Artes comemorativas</h1>
          <p className="muted">Transforme uma foto em uma ilustração de aniversário, Halloween ou Natal. Cada arte é uma interpretação artística da foto; alguns detalhes podem variar.</p>
        </div>

        <div className="notice notice--warn" role="status">
          <IconInfo />
          <span><strong>Ainda não disponível.</strong> A geração de artes precisa de um provedor de IA de imagem configurado. Nada aqui é gerado, cobrado ou simulado — você pode explorar o fluxo.</span>
        </div>

        <section className="stack" aria-labelledby="st1">
          <h2 id="st1">1. Escolha a foto</h2>
          {photos.length === 0 ? (
            <div className="card stitched empty" style={{ boxShadow: "none" }}>
              <p className="muted">Guarde uma foto no diário para usá-la aqui.</p>
              <Link href="/guardar" className="btn btn--secondary btn--small">Guardar momento</Link>
            </div>
          ) : (
            <div className="grid-photos" role="radiogroup" aria-label="Foto de referência">
              {photos.slice(0, 12).map((e) => (
                <button key={e.id} type="button" role="radio" aria-checked={photoId === e.mediaId} onClick={() => setPhotoId(e.mediaId)} style={{ outline: photoId === e.mediaId ? "3px solid var(--brand-primary)" : "none", outlineOffset: -3 }}>
                  <MediaImage id={e.mediaId} alt={e.caption || "Foto do diário"} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="stack" aria-labelledby="st2">
          <h2 id="st2">2. Escolha o tema</h2>
          <div role="radiogroup" aria-label="Tema" className="stack">
            {STUDIO_THEMES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} onClick={() => setTheme(t.id)} className="card" style={{ textAlign: "left", cursor: "pointer", padding: 12, borderColor: theme === t.id ? "var(--brand-primary)" : undefined, borderWidth: theme === t.id ? 2 : 1 }}>
                <div className="row" style={{ alignItems: "center" }}>
                  <div style={{ width: 120, flex: "none" }}><ThemeVignette id={t.id} /></div>
                  <div className="stack" style={{ gap: 2 }}>
                    <strong>{t.title}</strong>
                    <span className="small muted">{t.description}</span>
                    <span className="caption">Vinheta do tema, não prévia do resultado</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="card stack" aria-labelledby="st3">
          <h2 id="st3">3. Confirme</h2>
          <dl className="stack small" style={{ margin: 0, gap: 6 }}>
            <div className="row-between"><dt className="muted">Custo</dt><dd style={{ margin: 0 }}>{CREDITS.costPerGeneration} crédito por arte</dd></div>
            <div className="row-between"><dt className="muted">Seu saldo</dt><dd style={{ margin: 0 }}>{balance} créditos</dd></div>
          </dl>
          <button type="button" className="btn btn--primary btn--block" disabled aria-describedby="gen-off">
            <IconBrush /> Criar desenho
          </button>
          <p id="gen-off" className="caption">
            {FLAGS.generationPaused ? "A criação de artes está pausada no momento." : !providerConfigured ? "Disponível quando a geração por IA for configurada." : ""}
            {!CREDITS.paymentsEnabled ? " Compra de créditos ainda não existe nesta versão." : ""}
          </p>
        </section>

        <section className="stack" aria-labelledby="hist">
          <h2 id="hist">Suas artes</h2>
          <p className="muted small">As artes criadas ficarão aqui, para reencontrar sem pagar de novo. Nenhuma ainda.</p>
        </section>
      </main>
    </>
  );
}
