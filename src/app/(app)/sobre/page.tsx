"use client";

import { LEVELS } from "@/config/catalog";
import { XP_MONTH_GOAL } from "@/config/credits";
import { SUPPORT } from "@/config/business";
import { REAL_MODE } from "@/config/mode";
import { TopBar } from "@/components/shell";
import { AbuMascot } from "@/components/brand";
import { Paw } from "@/components/icons";

export default function Sobre() {
  return (
    <>
      <TopBar title="Sobre" back="/conta" />
      <main className="main">
        <section className="stack-lg" aria-labelledby="historia">
          <div className="achados-hero">
            <div className="achados-hero__abu"><AbuMascot width={96} alt="Abu, o cachorro que inspirou o Diário de Patas, segurando o livro" /></div>
            <div>
              <p className="studio-title" style={{ fontSize: "2rem", margin: 0 }}>Sobre o Diário</p>
              <p className="muted" style={{ margin: 0 }}>Quem somos, como cuidamos dos seus dados e como o app funciona.</p>
            </div>
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

        {!REAL_MODE ? (
          <section id="demo" className="card stack" aria-labelledby="demo-t">
          <h2 id="demo-t">O que é o modo demonstração</h2>
          <ul className="stack small" style={{ paddingLeft: 18, margin: 0 }}>
            <li>As fotos e o diário ficam guardados só neste navegador. Não há conta nem sincronização; limpar os dados do navegador apaga o diário.</li>
            <li>As missões são confirmadas por você: depois de escolher a foto, você diz se ela mostra o que a missão pede. As patinhas não valem dinheiro.</li>
            <li>O Estúdio de artes e os links de compartilhamento ainda não estão ativos.</li>
            <li>Nenhum pagamento existe nesta versão.</li>
          </ul>
        </section>
        ) : null}

        <section id="niveis" className="card stack" aria-labelledby="niveis-t">
          <h2 id="niveis-t">Patinhas, níveis e a arte do mês</h2>
          <p className="small">Patinhas 🐾 são os pontos das missões (10 ou 20 por foto guardada). O app conta de dois jeitos:</p>
          <ul className="small" style={{ margin: 0, paddingLeft: "1.2em", display: "grid", gap: 4 }}>
            <li><strong>Patinhas de sempre:</strong> somam tudo, ficam guardadas para sempre e definem o nível do seu cachorro.</li>
            <li><strong>Patinhas do mês:</strong> a contagem recomeça no dia 1º, com uma nova aventura. Com {XP_MONTH_GOAL} patinhas no mês, você ganha 1 crédito para criar uma arte no Estúdio (uma vez por mês).</li>
          </ul>
          <ol className="levels">
            {LEVELS.map((l, i) => (
              <li key={l.title}>
                <span className="levels__n">{i + 1}</span>
                <span className="levels__t">{l.title}</span>
                <span className="levels__xp">{l.minXp === 0 ? "início" : `${l.minXp} 🐾`}</span>
              </li>
            ))}
            <li><span className="levels__n">∞</span><span className="levels__t">Sempre juntos II, III…</span><span className="levels__xp">+250 🐾 cada</span></li>
          </ol>
        </section>

        <section className="stack" aria-labelledby="priv">
          <h2 id="priv">Privacidade</h2>
          <ul className="small privacy-list">
            <li><strong>Quem vê o diário:</strong> você e as pessoas que você convidar, conforme o papel de cada uma (pode adicionar momentos ou pode acompanhar). Quem é responsável pelo diário pode tirar alguém a qualquer momento.</li>
            <li><strong>Links compartilhados:</strong> quem tiver o link vê só as fotos que você escolheu, sem cuidados, documentos ou email. Você revoga em Perfil › Gerenciar diário; revogar não apaga cópias que alguém já tenha baixado.</li>
            <li><strong>Onde ficam as fotos:</strong> num armazenamento privado ligado à sua conta. Ao guardar, removemos a localização e outros dados escondidos da foto.</li>
            <li><strong>Estúdio:</strong> para conferir a foto e criar a arte, ela é enviada à API paga do Google (Gemini). Pelos termos dessa API, o conteúdo não é usado para treinar produtos do Google; pode ficar um registro por tempo limitado, só para detectar abusos. A arte sai com uma marca d’água invisível do Google.</li>
            <li><strong>Pagamentos:</strong> o Pix é processado pelo Mercado Pago; o app não vê dados bancários.</li>
            <li><strong>Avisos no celular:</strong> passam pelo serviço de notificações do seu aparelho (Apple ou Google). Você desliga em Minha conta › Notificações.</li>
            <li><strong>Excluir:</strong> em Minha conta › Excluir minha conta, ou só um diário em Perfil › Gerenciar diário.</li>
          </ul>
          <p className="caption" style={{ margin: 0 }}>Os termos de uso e a política de privacidade completos serão publicados antes do lançamento público.</p>
        </section>

        <section id="estudio" className="stack" aria-labelledby="estudio-t">
          <h2 id="estudio-t">Estúdio de artes</h2>
          <p className="small">Cada arte aparece no diário com o selo “🎨 Arte do Estúdio” e entra no limite de lembranças. Se o diário estiver cheio, a arte não é criada e nenhum crédito é usado.</p>
        </section>

        <section className="stack" aria-labelledby="sup">
          <h2 id="sup">Suporte</h2>
          {SUPPORT.email ? <p className="small"><a href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</a></p> : <p className="small muted">Canal de suporte ainda não definido.</p>}
        </section>
      </main>
    </>
  );
}
