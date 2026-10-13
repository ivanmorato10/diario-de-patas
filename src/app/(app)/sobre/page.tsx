"use client";

import { SUPPORT } from "@/config/business";
import { TopBar } from "@/components/shell";
import { AbuMascot } from "@/components/brand";
import { Paw } from "@/components/icons";

export default function Sobre() {
  return (
    <>
      <TopBar title="Sobre" back="/config" />
      <main className="main">
        <section className="stack-lg" aria-labelledby="historia">
          <div className="intro-visual" style={{ minHeight: 230 }}>
            <div className="intro-halo intro-halo--warm" aria-hidden="true" />
            <div className="anim-pop"><div className="anim-float"><AbuMascot width={170} alt="Abu, o cachorro que inspirou o Diário de Patas, segurando o livro" /></div></div>
          </div>
          <article className="stack intro-diary anim-rise about-letter" style={{ rotate: "-1deg" }}>
            <h1 id="historia">Nossa história</h1>
            <p className="intro__text">O Diário de Patas nasceu do amor que sentimos pelo Abu.</p>
            <p className="intro__text">Amamos a companhia dele, suas manias e o jeito como transforma um dia comum em um dia mais feliz. Ele faz parte da nossa família — e de tantas lembranças que queremos guardar com carinho.</p>
            <p className="intro__text">Criamos este espaço para reunir os passeios, as sonecas, as carinhas engraçadas e aqueles momentos que talvez só façam sentido para quem ama um cachorro como nós amamos o Abu.</p>
            <p className="intro__text">É ele quem aparece no nosso logo e recebe você por aqui. Uma homenagem ao nosso companheiro e um convite para você contar a história do seu.</p>
            <p className="intro__text about-letter__sign">Com amor, para o Abu.<br />E para todos os cachorros que fazem parte da família. <Paw size={22} className="intro-diary__paw" /></p>
          </article>
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
