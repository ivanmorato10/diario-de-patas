"use client";

import { SUPPORT } from "@/config/business";
import { TopBar } from "@/components/shell";
import { LogoCard } from "@/components/brand";

export default function Sobre() {
  return (
    <>
      <TopBar title="Sobre" back="/config" />
      <main className="main">
        <section className="stack" aria-labelledby="historia">
          <LogoCard width={200} className="anim-pop" />
          <h1 id="historia">Nossa história</h1>
          <p>O Diário de Patas nasceu inspirado no Abu e nos pequenos momentos que fazem a vida com um cachorro ser especial. Um passeio, uma soneca, uma expressão engraçada: aqui, cada momento pode virar uma lembrança.</p>
          <p className="caption">Inspirado no Abu. O Abu do logo é o nosso anfitrião: aparece para dar boas-vindas e comemorar as conquistas de vocês.</p>
        </section>

        <section id="demo" className="card stack" aria-labelledby="demo-t">
          <h2 id="demo-t">O que é o modo demonstração</h2>
          <ul className="stack small" style={{ paddingLeft: 18, margin: 0 }}>
            <li>As fotos e o diário ficam guardados só neste navegador. Não há conta nem sincronização; limpar os dados do navegador apaga o diário.</li>
            <li>As missões são confirmadas por você: depois de escolher a foto, você diz se ela mostra o que a missão pede. Os pontos não valem dinheiro.</li>
            <li>O Estúdio de artes e os links de compartilhamento ainda não estão ativos.</li>
            <li>Nenhum pagamento existe nesta versão.</li>
          </ul>
        </section>

        <section className="stack" aria-labelledby="priv">
          <h2 id="priv">Privacidade</h2>
          <p className="small">O diário é privado. Ao guardar uma foto, removemos dados de localização e outros metadados. Nesta versão, nenhuma foto sai do seu aparelho. Termos e política de privacidade completos serão publicados antes da versão com contas.</p>
        </section>

        <section className="stack" aria-labelledby="sup">
          <h2 id="sup">Suporte</h2>
          {SUPPORT.email ? <p className="small"><a href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</a></p> : <p className="small muted">Canal de suporte ainda não definido.</p>}
        </section>
      </main>
    </>
  );
}
