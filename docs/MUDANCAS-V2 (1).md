# Diário de Patas — pedido de mudanças v2

Data: 12/10/2026 · Autor: proprietário (Ivan) · Para: Claude Code

## Como usar

Na pasta do projeto, abra o Claude Code e envie:

> Leia STATUS.md, docs/BRIEFING.md, docs/BRAND.md e docs/MUDANCAS-V2.md. Implemente as mudanças de MUDANCAS-V2.md na ordem das seções 1 a 10, uma por vez (a 6 é o fechamento das seções 1–5; repita o fechamento ao fim da 10). Depois de cada seção: rode `npm test`, `npm run typecheck` e `npm run build`, corrija o que falhar e atualize STATUS.md. Mantenha a identidade visual atual (docs/BRAND.md), o modo demonstração (IndexedDB) e não ative pagamentos nem publique nada.

Este documento **substitui** o briefing onde houver conflito.

---

## 1. Missões confirmadas pelo dono (sem IA)

Decisão: a IA **não** valida mais fotos de missão. Os pontos não valem dinheiro; validar só gera custo, demora e frustração.

- A confirmação do dono (“Sim, mostra” / “Não tenho certeza”) passa a ser o **modo oficial**, não “demonstração”.
  - Texto da conquista: “Confirmada por você”, sem mencionar IA.
- Remover o limite de 5 validações por dia: `LIMITS.validationsPerDay`, os textos de limite nas telas de missão, guardar e configurações, e o contador `usage`.
  - Manter o teste de idempotência: XP continua sendo concedido uma única vez por missão.
- Manter `src/domain/validation.ts` e `PhotoValidator` no código, **desligados**, documentados como “futuro: sugestão de missão por IA, nunca bloqueio”.
- Atualizar Sobre, STATUS.md e ARCHITECTURE.md (remover a Etapa D de validação; anotar “IA só no Estúdio e em sugestões futuras”).

**Aceite:** nenhuma tela fala em validação por IA ou em limite diário de missões; os testes de XP único continuam passando.

## 2. Fotos livres, sem precisar de missão

O fluxo “Guardar momento” já existe. Melhorar:

1. **Destaque.** Botão “Guardar momento” bem visível em Hoje e Diário. É o que já existe; revisar se está claro.
2. **Várias fotos de uma vez.** Na galeria, permitir selecionar várias fotos (`multiple`).
   - Para cada foto: legenda e data opcionais. A data vem do EXIF da foto quando existir; senão, hoje.
   - Botão único “Guardar todas”.
   - Respeitar o limite de lembranças e mostrar quantas cabem.
   - Retry não duplica: cada foto tem a sua `requestKey`.
3. **Usar uma foto do diário numa missão.**
   - Na lembrança do Diário, nova ação “Usar numa missão”.
   - Ela abre a lista de missões disponíveis e leva direto à confirmação com aquela foto, sem novo upload.
   - Se a missão já foi concluída, avisar que os pontos não somam de novo.
4. **Álbuns.** Fotos livres podem entrar em qualquer álbum, como já acontece, mas não contam como conquista.

**Aceite:**
- Selecionar 5 fotos da galeria cria 5 lembranças.
- Uma lembrança livre pode concluir uma missão depois, sem duplicar a foto.

## 3. Catálogo maior de missões

Adicionar as missões abaixo em `src/config/catalog.ts` e espelhar em `supabase/seed.sql`; o teste de paridade precisa continuar passando.

Regras para todas:
- Pré-requisito M01.
- Fotos antigas valem.
- Nenhuma missão pede comida extra, situação perigosa, fantasia desconfortável, carro quente ou compra.
- Missões externas sempre têm alternativas em casa.
- Missões de data especial são opcionais e não bloqueiam nada.

Nova coleção: **`estacoes-e-datas`** (“Estações e datas”). A coleção existente “Datas especiais” continua só para as artes do Estúdio.

Nova coleção: **`cuidados`** (“Cuidados”), ligada à seção 4.

| ID | Missão | O que a foto mostra | XP | Coleção | Contexto |
|---|---|---|---:|---|---|
| M13 | Primeiro dia em casa | Uma foto do começo de vocês (vale foto antiga) | 15 | Primeiras lembranças | any |
| M14 | Patinha de perto | Close da patinha | 10 | Primeiras lembranças | any |
| M15 | Meu nome | A coleira ou plaquinha com o nome | 10 | Primeiras lembranças | any |
| M16 | Bocejo flagrado | O cachorro bocejando | 15 | Manias e expressões | home |
| M17 | Posição estranha de dormir | Aquela pose impossível dormindo | 15 | Vida em casa | home |
| M18 | Esperando na porta | Esperando alguém chegar | 10 | Vida em casa | home |
| M19 | Hora do banho | Durante ou logo depois do banho | 15 | Cuidados | home |
| M20 | Cheiroso | Depois do banho ou da tosa | 10 | Cuidados | any |
| M21 | Dia de chuva | Olhando a chuva ou no tapete secando | 10 | Estações e datas | home |
| M22 | Esconderijo favorito | O lugar secreto preferido | 10 | Vida em casa | home |
| M23 | Dono do sofá | Ocupando o sofá ou a cama | 10 | Vida em casa | home |
| M24 | Selfie juntos | Você e o cachorro numa selfie | 15 | Nosso vínculo | people |
| M25 | Patinha na mão | A patinha na sua mão | 15 | Nosso vínculo | people |
| M26 | Colo bom | No colo de alguém | 10 | Nosso vínculo | people |
| M27 | Família reunida | Ele junto com a família | 20 | Nosso vínculo | people |
| M28 | Bom dia | A primeira foto do dia | 10 | Nosso vínculo | any |
| M29 | Boa noite | Pronto para dormir | 10 | Nosso vínculo | home |
| M30 | Cabeça inclinada | A famosa cabecinha de lado | 15 | Manias e expressões | any |
| M31 | Língua de fora | Linguinha aparecendo | 10 | Manias e expressões | any |
| M32 | Orelhas em ação | Orelhas em pé, viradas ou voando | 10 | Manias e expressões | any |
| M33 | Cara de culpado | Depois de aprontar | 15 | Manias e expressões | home |
| M34 | Truque favorito | Fazendo um truque que sabe | 20 | Manias e expressões | any |
| M35 | Brinquedo sobrevivente | O brinquedo mais destruído de todos | 10 | Vida em casa | home |
| M36 | Correria! | Correndo (foto tremida vale) | 15 | Pequenas aventuras | any |
| M37 | Novo caminho | Um passeio por um lugar novo | 20 | Pequenas aventuras | outdoor |
| M38 | Pôr do sol | Passeio no fim da tarde | 15 | Pequenas aventuras | outdoor |
| M39 | Pegadas | Pegadas na areia, terra ou neve | 15 | Pequenas aventuras | outdoor |
| M40 | Lugar pet friendly | Num café, loja ou parque que aceita pets | 20 | Pequenas aventuras | outdoor |
| M41 | Na estrada | Passeio de carro com segurança (cinto ou caixa) | 15 | Pequenas aventuras | outdoor |
| M42 | Dia de praia | Na praia ou na beira d’água (opcional) | 20 | Estações e datas | outdoor |
| M43 | Dia de frio | De roupinha confortável ou enrolado na manta | 10 | Estações e datas | home |
| M44 | Dia de calor | Na sombra, com água fresca por perto | 10 | Estações e datas | any |
| M45 | Feliz aniversário | Comemorando o aniversário (opcional) | 20 | Estações e datas | any |
| M46 | Natal juntos | Clima de Natal (opcional) | 15 | Estações e datas | home |
| M47 | Visita ao veterinário | Na consulta ou na sala de espera | 15 | Cuidados | any |
| M48 | Unhas e tosa | Dia de cuidado com unhas ou pelos | 10 | Cuidados | any |

**Níveis.** O catálogo passa de 160 para 650 XP. Novos níveis:

| XP | Nível |
|---:|---|
| 0 | Novo companheiro |
| 30 | Colecionador de momentos |
| 70 | Explorador |
| 120 | Guardião de lembranças |
| 220 | Contador de histórias |
| 350 | Melhores amigos |
| 500 | Sempre juntos |

Nenhum nível pode exigir mais XP do que o catálogo oferece; manter o teste que garante isso.

**Interface:**
- A lista de missões fica agrupada por coleção, com filtro “Disponíveis / Concluídas”.
- “Hoje” continua sugerindo até 3 missões.

**Aceite:** 48 missões no catálogo, seed igual ao catálogo, testes de níveis passando.

## 4. Ficha de saúde do cachorro (“Cuidados”)

**Novo item na navegação: Cuidados.** A barra inferior passa a ter 5 itens: Hoje · Diário · Álbuns · Cuidados · Estúdio. Verificar se cabe em 360 px com área de toque de 44 px. Se não couber, mover Estúdio para dentro de Álbuns.

O dono registra informações. **O app não interpreta, não diagnostica e não dá conselho médico.** Aviso fixo e discreto na seção: “Estas anotações não substituem o veterinário. Em emergência, procure atendimento.”

### 4.1 Dados do cachorro

Todos opcionais e digitados pelo dono:
- raça (texto livre);
- sexo;
- castrado;
- número do microchip;
- cor/pelagem;
- alergias e restrições (texto livre);
- observações.

O peso tem histórico: data + kg, com um gráfico simples de linha quando houver 2 registros ou mais.

### 4.2 Vacinas e vermífugos

**Campos:**
- tipo (vacina, vermífugo, antipulgas, outro);
- nome;
- data aplicada;
- próxima dose (opcional);
- veterinário/clínica (opcional);
- foto da etiqueta ou da carteirinha (opcional, vira um Documento).

**Status calculado pela data:**
- em dia;
- próxima em até 30 dias;
- atrasada (usar texto e ícone, não só cor).

### 4.3 Consultas e visitas

**Campos:**
- data;
- clínica;
- veterinário;
- motivo;
- o que foi feito / orientações (texto);
- próxima consulta (opcional);
- anexos (documentos).

A visita pode gerar uma lembrança no Diário: “Guardar uma foto desta visita”, que conclui a M47 se o dono confirmar.

### 4.4 Medicamentos

**Campos:**
- nome;
- dose (texto);
- frequência (texto);
- início;
- fim (opcional);
- observações.

O medicamento aparece como “em uso” enquanto não tiver fim, ou até a data de fim. O app não calcula doses.

### 4.5 Contatos

Veterinário, clínica, emergência 24h, pet sitter, outros. Cada contato tem nome, telefone, endereço e observações. Botões “Ligar” (`tel:`) e “Abrir no mapa” (link de busca, sem coletar localização).

### 4.6 Próximos cuidados

- Em **Hoje**, um cartão “Próximos cuidados” com as próximas vacinas e consultas dos próximos 30 dias, mais as atrasadas.
- Notificações push ficam para depois (P1). Por enquanto, só lembretes dentro do app.

### Dados e privacidade

- Novos stores no IndexedDB, com migração de versão do banco **sem perder** os dados existentes: `healthProfile`, `weights`, `vaccines`, `visits`, `medications`, `contacts`.
- Criar o modelo equivalente em uma nova migration SQL com RLS (owner_id), sem aplicar.
- Dados de saúde **nunca** entram em links compartilhados, analytics ou Open Graph.
- Entram na exportação e são apagados em “Apagar diário”.

**Aceite:**
- Criar, editar e excluir cada tipo de registro.
- O status das vacinas é correto, com testes de datas e fusos.
- Os dados persistem ao recarregar.
- Apagar diário remove tudo.

## 5. Documentos importantes

Área **Documentos**, dentro de Cuidados.

**Categorias:**
- carteira de vacinação;
- RG pet / microchip;
- pedigree;
- exames;
- receitas;
- seguro/plano;
- contrato de adoção ou compra;
- outros.

**Campos:**
- título;
- categoria;
- data do documento;
- validade (opcional);
- observações;
- arquivo.

**Arquivos:**
- PDF, JPEG, PNG ou WebP, até 10 MB.
- Validar pelos bytes: `%PDF` para PDF e as assinaturas atuais para imagem.
- Imagens passam pelo mesmo processamento das fotos: EXIF corrigido, metadados removidos e miniatura.
- PDFs são guardados como estão.
- Limite de teste: 50 documentos.

**Ações:** ver (PDF abre numa nova aba via blob URL), baixar, editar dados e excluir com confirmação.

**Validade:** aviso “vence em breve” (30 dias) e “vencido”, também no cartão “Próximos cuidados”.

**Privacidade:**
- Documentos nunca aparecem no Diário, nos Álbuns ou em compartilhamentos.
- Na versão com servidor: bucket privado separado, acesso só do dono.

**Aceite:**
- Enviar um PDF real e uma foto, abrir os dois, excluir.
- Um arquivo de texto renomeado para .pdf é recusado.
- O aviso de validade aparece corretamente.

## 6. Fechamento

- Atualizar `docs/BRIEFING.md` com uma nota no topo: “Atualizado por MUDANCAS-V2: IA não valida missões; app inclui ficha de cuidados e documentos como registro do dono, sem função veterinária.”
- Atualizar STATUS.md, docs/BACKLOG.md e docs/TESTING.md.
- Rodar o teste E2E (`scripts/e2e.py`) e ampliar com:
  - várias fotos de uma vez;
  - usar uma foto do Diário numa missão;
  - criar uma vacina com próxima dose em 10 dias e ver o aviso em Hoje;
  - enviar e abrir um PDF.
- Conferir 360 px, 390 px e desktop sem rolagem horizontal.
- Commit por seção, com mensagens claras.

## Fora deste pedido

Não fazer agora:
- notificações push;
- integração com clínicas;
- leitura automática de documentos por IA;
- pagamentos reais;
- publicação.


---

## 7. Ciclo contínuo de missões (o jogo não acaba)

Três tipos de missão:

| Tipo | Como funciona | Pontos |
|---|---|---|
| **Missões do dia** | 3 sugestões que mudam diariamente, tiradas de um banco revisado | 10 XP cada, **uma vez por dia sorteado** (repetíveis em outros dias) |
| **Coleções permanentes** | Grupos de 6 desafios que preenchem uma página do álbum, sem prazo | 15 XP por item, **uma vez para sempre**; completar a coleção = medalha + capa especial + 50 XP |
| **Missões especiais** | Aparecem em datas ou ocasiões | 20 XP, uma vez por ocorrência (ex.: por ano) |

As 48 missões das seções 1–3 continuam como missões únicas, nos álbuns atuais. Cada missão do catálogo passa a ter `kind`, com um destes valores: `once` (atuais), `daily`, `collection_item` ou `special`.

### 7.1 Regras

1. **Virada do dia.** As sugestões mudam à meia-noite no fuso do usuário.
   - Na primeira abertura do dia, o plano é gravado: `dailyPlan` no IndexedDB, `daily_plans` no Supabase.
   - Reabrir o app no mesmo dia mostra o mesmo plano.
2. **Sorteio determinístico** por `hash(dogId + data)`.
   - Um espaço por categoria: **casa e descanso**, **companhia e brincadeira**, **passeio ou retrato**.
   - Se a pessoa disse que não faz passeios, o terceiro espaço vira retrato.
   - Respeitar as preferências do cadastro.
   - Não repetir uma missão diária concluída ou sugerida nos últimos **14 dias**.
3. **Trocar** uma sugestão é gratuito e troca por outra do mesmo espaço. A troca fica gravada no plano do dia.
4. **Uma foto rende pontos em uma única missão.** Ela pode aparecer em vários álbuns.
5. **Sem punição.** Missões não concluídas não tiram pontos, não existe sequência obrigatória e nenhuma mensagem gera culpa.
6. **Progresso de coleção.** Concluir uma missão pode avançar uma coleção relacionada, quando o catálogo liga a missão diária a um item de coleção, sem novo envio da foto. Avançar não dá XP extra; completar a coleção dá.
7. **Quem confirma é o dono** (seção 1). Sem IA na validação.

### 7.2 Telas

**Hoje**
- As 3 missões do dia, cada uma com “Trocar”.
- Progresso “2 de 3 hoje”.
- Ao concluir as 3, aparece o cartão abaixo, com a animação de patinhas (sem emoji):
  > **Aventuras de hoje concluídas!** Suas fotos já estão no álbum. Amanhã tem mais — e você ainda pode explorar suas coleções.
  - Botões do cartão: “Ver coleções” e “Guardar mais um momento”.

**Coleções**
- Fica dentro de Álbuns, numa aba “Coleções”.
- Cada coleção mostra uma grade de 6 espaços (figurinha vazia ou foto) e um contador.
- Ao completar: medalha com a animação de carimbo, e uma capa especial montada com as 6 fotos da pessoa (colagem gerada no navegador com canvas; não é IA).
- A coleção concluída continua visível para rever e compartilhar, e o app sugere a próxima.

**Especiais**
- Aparecem como um cartão destacado em Hoje durante a janela da data.

### 7.3 Níveis sem fim

Manter os 7 níveis da seção 3. Depois de “Sempre juntos” (500 XP), os níveis continuam como “Sempre juntos II, III…”, a cada 250 XP. Mostrar também “dias com lembranças” (contagem simples, **sem** sequência que quebra) e o número de medalhas.

### 7.4 Missões do dia (banco inicial, 36)

**Espaço A — casa e descanso**

| ID | Missão |
|---|---|
| D01 | Meu cantinho favorito |
| D02 | Soneca da tarde |
| D03 | Esperando o petisco de sempre |
| D04 | Na janela |
| D05 | Depois da aventura, descanso |
| D06 | Espreguiçada |
| D07 | No tapete |
| D08 | Hora da refeição de sempre |
| D09 | Bagunça do dia |
| D10 | Cochilo no sol |
| D11 | Olhar de “já acabou?” |
| D12 | Foto do dia em casa |

**Espaço B — companhia e brincadeira**

| ID | Missão |
|---|---|
| D13 | Brinquedo inseparável |
| D14 | Companhia no sofá |
| D15 | Foto com meu humano |
| D16 | Cabo de guerra |
| D17 | Buscando a bolinha |
| D18 | Carinho na barriga |
| D19 | Treino de um truque |
| D20 | Brincando com alguém da família |
| D21 | Juntinhos |
| D22 | Recebendo alguém em casa |
| D23 | Momento de carinho |
| D24 | Brincadeira inventada |

**Espaço C — passeio ou retrato** (os itens marcados com † são retrato e servem para quem não passeia)

| ID | Missão |
|---|---|
| D25 | Passeio do dia |
| D26 | Explorando um cheiro |
| D27 | Retrato de pertinho † |
| D28 | Perfil elegante † |
| D29 | Olhando para a câmera † |
| D30 | Grama ou terra |
| D31 | Encontro na rua (só se a preferência de outros cães permitir) |
| D32 | Uma pose engraçada † |
| D33 | Céu de hoje no passeio |
| D34 | De volta para casa |
| D35 | Retrato com luz bonita † |
| D36 | Close no focinho † |

Cada missão do dia precisa de: descrição de uma linha, critério visível curto, espaço, contexto (preferências) e, quando fizer sentido, o item de coleção que ela avança.

### 7.5 Coleções permanentes (5 no lançamento)

Onde já existe uma missão equivalente na seção 3, **reaproveitar o mesmo ID**, sem duplicar.

| Coleção | Itens (6) |
|---|---|
| **As poses de dormir** | Enroladinho · Barriga pra cima · Esparramado · Focinho na patinha · Dormindo com o brinquedo · Posição estranha (=M17) |
| **Caras e expressões** | Cabeça inclinada (=M30) · Língua de fora (=M31) · Cara de culpado (=M33) · Orelhas em ação (=M32) · Bocejo (=M16) · Olhar pidão |
| **Nossos passeios** | Manhã · Fim da tarde (=M38) · Lugar novo (=M37) · Pegadas (=M39) · Grama verdinha · Voltando cansado — alternativa sem passeio: quintal, varanda ou janela |
| **Nós dois** | Selfie (=M24) · Patinha na mão (=M25) · Colo (=M26) · Sofá juntos · A mesma pose · Família (=M27) |
| **Brinquedos e manias** | Brinquedo favorito (=M03) · Sobrevivente (=M35) · Bolinha · Cabo de guerra · Esconderijo de brinquedos · A mania que só ele tem |

Um item já concluído antes desta mudança, como M24, conta automaticamente na coleção. Isso precisa de migração do progresso e de teste.

### 7.6 Missões especiais (3 no lançamento)

| ID | Tema | Janela |
|---|---|---|
| S01 | **Aniversário do [nome]** | 7 dias antes até 7 dias depois da data de nascimento; só aparece se a data foi informada; uma vez por ano |
| S02 | **Natal juntos** | 1 a 26 de dezembro |
| S03 | **Halloween divertido** | 24 a 31 de outubro. Fantasia só se ele ficar confortável; foto com abóbora ou decoração também vale |

Cada especial liga com o tema equivalente do Estúdio: depois da foto, aparece “Transformar em arte de Natal?”, usando a seção 9.

### 7.7 Aceite

- O mesmo dia e o mesmo cachorro dão sempre as mesmas 3 sugestões, mesmo recarregando.
- Mudar de dia muda as sugestões, respeitando o fuso (testar fusos de São Paulo e Tóquio na virada).
- A troca persiste.
- Nada se repete em 14 dias.
- Uma missão diária dá XP uma vez naquele dia e pode dar de novo em outro dia sorteado.
- Uma foto não dá pontos em duas missões.
- Concluir as 6 de uma coleção dá a medalha e os 50 XP uma única vez, mesmo com requisições simultâneas.
- As especiais só aparecem dentro da janela.

---

## 8. Contas reais com Supabase (Etapa C do briefing)

Objetivo: testar com usuários de verdade, cada um com a sua conta, mantendo o modo demonstração disponível.

### 8.1 Ambiente

1. **Local primeiro.**
   - Usar o Supabase CLI com `supabase start`, que exige Docker. Ensinar o Ivan a instalar o Docker no Linux dele, se faltar.
   - Os emails de login ficam no visualizador de emails local do Supabase; não sai nenhum email real.
2. **Depois, na nuvem.**
   - Guiar o Ivan para criar o projeto no site do Supabase (plano gratuito) e aplicar as migrations com `supabase link` e `supabase db push`.
   - As chaves ficam **só** no `.env.local` e no painel do host. Nunca no chat, em commits ou no código.
3. **Escolha do modo.**
   - Com `NEXT_PUBLIC_SUPABASE_URL` configurado, o app roda em modo real.
   - Sem ela, roda em modo demonstração.
   - O banner do modo demo some no modo real.

### 8.2 Implementar

- Login por email com código ou link mágico (Supabase Auth), sessão por cookie, `middleware` protegendo as rotas do app.
- **“Já tenho conta”** passa a funcionar.
- **Repositório Supabase** com a mesma interface do repositório demo: perfil, cachorro, lembranças, álbuns, missões (incluindo a seção 7), XP, cuidados e documentos (seções 4 e 5).
- **Ajustar as migrations:**
  - tabelas da seção 4;
  - tabela da seção 5;
  - `daily_plans` e progresso de coleções da seção 7;
  - tudo com RLS por dono;
  - conclusão de missão e medalhas por funções idempotentes no servidor.
- **Upload:**
  - o cliente processa a imagem (como hoje);
  - o servidor confere tipo e tamanho reais antes de confirmar (usar `sharp` nas rotas do servidor);
  - bucket **privado** `media` e bucket privado separado `documents`;
  - mídia entregue por URL assinada de curta duração ou rota que revalida o dono;
  - limpeza de uploads órfãos.
- **Importar o diário do modo demo para a conta**, uma única vez, com confirmação, sem duplicar se repetir.
- **Compartilhamento revogável** (§12 do briefing):
  - token aleatório guardado só como hash;
  - página `/s/:token` mostrando só a seleção;
  - revogação imediata;
  - `noindex`;
  - nunca inclui dados de saúde ou documentos.
- **Exclusão de conta:** corta o acesso, revoga links, cancela jobs e apaga os arquivos dos buckets.

### 8.3 Aceite

- Duas contas reais (A e B) testadas.
- B não consegue ler nada de A por URL ou ID, incluindo mídia, documentos, links, jobs e dados de saúde. Isso fica num teste automatizado de RLS.
- Dados persistem depois de sair e entrar de novo.
- Link revogado para de funcionar.
- Excluir a conta remove o acesso e os arquivos.
- O modo demo continua funcionando sem variáveis de ambiente.
- Registrar no STATUS o que foi testado local e o que foi testado na nuvem.

---

## 9. Estúdio com IA de verdade

Objetivo: transformar uma foto do cachorro em arte de Aniversário, Natal ou Halloween, usando a **foto como referência** (o cachorro tem que continuar parecido).

### 9.1 Provedor: Google Gemini (decidido pelo Ivan)

O provedor escolhido é o **Gemini (API de imagem do Google)**. Antes de programar, confira na documentação oficial (ai.google.dev) o ID atual do modelo de edição com imagem de referência. Em 12/10/2026, a página indicava `gemini-nano-banana-2.1` como principal e `gemini-3-pro-image` como premium. Confira também o preço atual por imagem e mostre ao Ivan uma estimativa de custo por arte.

As imagens geradas pelo Gemini trazem a marca d’água invisível SynthID. Isso combina com o selo “Arte criada com IA”.

### 9.1-b (referência) Como comparar provedores, caso seja preciso trocar

Antes de programar:
- Pesquisar a **documentação oficial e os preços atuais** de pelo menos três opções que aceitem imagem de referência, por exemplo os modelos de imagem da OpenAI, os do Google Gemini e o FLUX Kontext da Black Forest Labs.
- Apresentar ao Ivan uma tabela com:
  - custo por imagem no tamanho que vamos usar;
  - tempo médio;
  - fidelidade ao cachorro (testar com 2 ou 3 fotos);
  - regras de conteúdo;
  - retenção e uso das fotos pelo provedor;
  - se tem webhook ou exige polling.
- Recomendar uma opção e **esperar a escolha e a chave**.
- Não usar preços de memória.

### 9.2 Implementar

- **Adapter só no servidor** (`ArtGenerator`), trocável, com chave em variável de ambiente.
  - Se o provedor não aceitar foto de referência, marcar como incompatível. Nunca gerar uma imagem genérica no lugar.
- **Prompt-base** do briefing §11, com um preset por tema e sem prompt livre. Nome e mensagem são desenhados pelo app por cima da arte, nunca pela IA.
- **Jobs persistentes** (`generation_jobs`): `queued → processing → succeeded | failed | cancelled`.
  - Chave de idempotência por pedido.
  - Reabrir a tela recupera o job existente.
  - Timeout ambíguo: consultar o provedor antes de repetir.
- **Créditos** pelo ledger que já existe:
  - reserva antes de gerar;
  - consumo só depois de salvar o resultado;
  - liberação em falha confirmada.
  - **Sem pagamento:** créditos de teste concedidos por variável de ambiente (`STUDIO_TEST_CREDITS`, por exemplo 5 por conta), identificados como “créditos de teste”.
- **Proteções de custo:**
  - limite diário por conta;
  - limite global diário (`STUDIO_MAX_DAILY_GENERATIONS`);
  - `GENERATION_PAUSED=true` pausa tudo sem afetar o resto do app;
  - registrar o custo estimado por job em `usage_events`.
- **Resultado:**
  - fica salvo no álbum “Datas especiais” com o selo “Arte criada com IA” e uma miniatura da foto original ao lado;
  - aviso “Uma interpretação artística da foto; alguns detalhes podem variar”;
  - pode ser baixado;
  - aparece no histórico do Estúdio sem cobrar de novo;
  - **arte nunca conclui missão de foto real.**
- **Em modo demo** (sem servidor), o Estúdio continua mostrando “disponível com conta” e não simula nada.

### 9.3 Aceite

- Uma arte real gerada a partir de uma foto real, com o cachorro reconhecível (o Ivan confere com foto do Abu).
- Duplo clique não cria dois jobs nem cobra duas vezes.
- Uma falha devolve o crédito.
- Fechar e reabrir a tela recupera o job.
- O limite global bloqueia ao ser atingido.
- O custo médio por arte fica registrado no STATUS, para definir o preço depois.


---

## 10. Estúdio completo: mais opções e prompts prontos para o Gemini

### 10.1 Organização no app

O Estúdio passa a ter **4 abas**:

1. **Datas** — temas de comemoração.
2. **Estilos** — o cachorro desenhado em estilos artísticos.
3. **Fantasias** — o cachorro como personagem.
4. **Formatos** — figurinha, papel de parede, cartão.

**Fluxo de uso:**

1. Escolher a foto.
2. Escolher a aba e o preset. Cada preset tem uma vinheta ilustrativa marcada como “exemplo de estilo”.
3. Opções extras, quando o preset permitir:
   - nome e mensagem, desenhados **pelo app** depois da geração;
   - proporção.
4. Mostrar o custo e confirmar.
5. Acompanhar a geração e ver o resultado, com a foto original ao lado.
6. Baixar, guardar no álbum “Datas especiais” ou gerar outra variação (novo crédito).

**Dica antes de gerar:** “Use uma foto com o cachorro bem visível e sozinho”. Se a foto tiver mais de um cachorro, oferecer um recorte manual antes de enviar.

**Custos:**
- Presets normais custam **1 crédito**.
- Presets marcados `premium` (usam o modelo premium) custam **2 créditos**.
- Os créditos ficam configuráveis por preset em `src/config/studio.ts`, nunca espalhados pelos componentes.

### 10.2 Estrutura do prompt (sempre montada pelo servidor)

O usuário **nunca** escreve prompt livre. O servidor junta três partes e envia **a foto do usuário + o texto** ao Gemini:

```
[BASE] + [PRESET] + [FORMATO]
```

Os prompts ficam em inglês, que dá resultados mais estáveis. A interface fica em português. Cada preset tem `id`, `version`, `category`, `labelPt`, `prompt`, `aspect`, `credits`, `premium` e `addTextOverlay`. O job grava `preset_id + version`, para dar para comparar resultados quando um prompt mudar.

**[BASE] — enviado em toda geração:**

> Use the attached photo as the only reference for the dog. Keep it recognizably the same individual dog: same breed traits, the same coat colors and markings in the same places, the same ear shape and position, muzzle shape, eye color and body proportions. If a collar is visible, keep its color. If the photo shows more than one dog, use only the most prominent one. Do not add other animals or any people. Do not write any text, letters, numbers, logos, signatures or watermarks anywhere in the image. The dog must look healthy, relaxed and happy, never in danger, distress, pain or wearing anything that restricts its movement or covers its eyes, nose or mouth. Keep the dog as the clear main subject, with the whole head fully visible and not cropped.

**[FORMATO] — conforme a proporção escolhida:**

| Formato | Texto | Aspecto |
|---|---|---|
| Quadrado | Square composition, subject centered with breathing room around it. | 1:1 |
| Retrato | Vertical portrait composition, subject in the upper two thirds, calm area at the bottom. | 4:5 |
| Papel de parede | Tall phone wallpaper composition, subject in the middle third, simple uncluttered areas at the top and bottom for the clock and icons. | 9:16 |

### 10.3 Presets — Datas (aba 1)

| id | Nome no app | Prompt do preset |
|---|---|---|
| `aniversario` | Aniversário | A joyful birthday illustration: the dog wearing a small soft party hat, sitting next to a dog-safe birthday cake with one candle, colorful balloons and confetti floating in a bright cheerful room. Warm soft lighting, festive pastel colors, charming editorial illustration style. |
| `natal` | Natal acolhedor | A cozy Christmas scene: the dog resting on a soft knitted blanket beside a decorated Christmas tree with warm glowing fairy lights and wrapped presents. Gentle warm light, red, green and gold tones, storybook illustration style. |
| `halloween` | Halloween divertido | A cute, not scary Halloween scene: the dog sitting among carved smiling pumpkins, autumn leaves and paper bats, with a tiny soft witch hat or a comfortable orange bandana. Playful purple and orange tones, friendly children's book illustration style. |
| `dia-dos-animais` | Dia dos Animais (4/10) | A sunny celebration in a green park: the dog surrounded by flowers and gentle sunlight, with soft bokeh and small floating paw-print shapes in the sky. Joyful, warm, hopeful mood, soft illustration style. |
| `festa-junina` | Festa Junina | A Brazilian Festa Junina scene: the dog wearing a small checkered (plaid) bandana, colorful paper flag garlands (bandeirinhas) overhead, a warm bonfire glow at a safe distance in the background and a straw hat resting beside it. Cozy evening light, festive and rustic illustration style. |
| `pascoa` | Páscoa | A gentle spring scene: the dog in a meadow with pastel decorated eggs in a basket (eggs are not being eaten) and soft spring flowers. Pastel colors, light and airy illustration style. |
| `ano-novo` | Ano Novo | A New Year's night celebration: the dog wearing a small shiny party bow, sitting by a window with colorful fireworks far away in the night sky and soft golden sparkles. The dog looks calm and safe indoors. Elegant night colors, glowing illustration style. |
| `dia-das-maes-pet` | Mãe/Pai de pet | A tender portrait of the dog holding a small bouquet of flowers in a soft pastel setting with a heart-shaped soft-focus background. Loving, warm mood, gentle watercolor-like illustration style. (O app escreve “Feliz Dia das Mães” ou “dos Pais” por cima.) |

### 10.4 Presets — Estilos (aba 2)

| id | Nome no app | Prompt do preset |
|---|---|---|
| `estilo-diario` | Estilo Diário de Patas | Transform the photo into a clean 2D cartoon illustration with soft brown outlines, rounded friendly shapes, warm flat colors with subtle shading, on a soft aqua circular background — like a cute app mascot. Keep the dog's real markings. |
| `aquarela` | Aquarela | A delicate watercolor painting of the dog: soft washes, visible paper texture, gentle color bleeding at the edges, white background with loose splashes. |
| `lapis` | Desenho a lápis | A detailed graphite pencil drawing of the dog on cream paper: fine hatching, soft shading, realistic fur texture, a few loose sketch lines at the edges. |
| `oleo-classico` | Retrato clássico (premium) | A classic oil painting portrait in the style of 18th-century European court portraits: the dog posed nobly on a velvet cushion, dark warm background, rich textured brushstrokes, soft dramatic lighting. Dignified and charming. |
| `pop-art` | Pop art | A bold pop art print of the dog: flat vivid color blocks, thick black outlines, halftone dot shading, bright contrasting background. |
| `3d-fofo` | Animação 3D | A cute high-quality 3D animated movie style render of the dog: soft rounded shapes, big expressive but natural eyes, glossy fur, warm cinematic lighting, simple colorful background. Original character design, not resembling any existing film character. |
| `pixel` | Pixel art | Retro 16-bit pixel art of the dog: limited color palette, crisp pixels, simple pastel background, like a cozy video game sprite portrait. |
| `vitral` | Vitral | The dog depicted as a colorful stained glass window: bold dark lead lines, glowing jewel-toned glass pieces, light shining through. |

### 10.5 Presets — Fantasias (aba 3)

Todas com roupa confortável e solta. Nunca máscaras, nada cobrindo olhos, nariz ou boca.

| id | Nome no app | Prompt do preset |
|---|---|---|
| `astronauta` | Astronauta | The dog as a cute astronaut floating in space wearing an open-face spacesuit (no helmet glass over the face), stars, a small planet and a friendly rocket in the background. Whimsical illustration style. |
| `super-heroi` | Super-herói | The dog as an original superhero with a flowing cape and a simple paw emblem on the chest (no existing superhero logos or costumes), standing proudly on a rooftop at sunset. Dynamic comic illustration style. |
| `realeza` | Realeza (premium) | The dog as royalty: a small golden crown, a red velvet royal cape with white trim, sitting on an ornate throne in a grand palace hall. Rich painterly style. |
| `chef` | Chef | The dog as a chef wearing a small white chef hat and apron in a cozy kitchen, next to dog-safe treats on the counter (no chocolate, grapes, onions or other foods toxic to dogs). Warm illustration style. |
| `explorador` | Explorador | The dog as a jungle explorer with a small safari hat and a little backpack, in a lush green jungle with friendly parrots far in the background. Adventure storybook style. |
| `detetive` | Detetive | The dog as a classic detective with a small tweed cap and a magnifying glass, on a cozy old street at night under a warm lamp light. Charming noir illustration style, not dark or scary. |
| `surfista` | Surfista | The dog on a beach at sunset next to a colorful surfboard stuck in the sand (the dog is on the sand, not in the waves), wearing a flower lei. Bright tropical illustration style. |
| `futebol` | Craque do futebol | The dog as a soccer star on a green field with a soccer ball, wearing a plain yellow and green bandana (no team crests, no brand logos, no real kits). Energetic sports illustration style. |

### 10.6 Presets — Formatos (aba 4)

| id | Nome no app | Prompt do preset | Pós-processamento no app |
|---|---|---|---|
| `figurinha` | Figurinha para WhatsApp | A cute die-cut sticker of the dog's head and shoulders in a clean cartoon style, thick white outline around the whole shape, on a plain solid flat light green background (#00FF00) for easy removal, no shadow. | Remover o fundo verde no servidor (chroma key), exportar **WebP 512×512 com transparência** e oferecer download. Instruir como adicionar ao WhatsApp, sem integrar com o WhatsApp. |
| `papel-de-parede` | Papel de parede | A calm, beautiful illustrated scene with the dog resting in a soft dreamy landscape, gentle gradient sky, plenty of simple space. | Forçar 9:16 e exportar em resolução de celular. |
| `cartao` | Cartão com mensagem | A clean illustrated portrait of the dog with a soft solid pastel background and generous empty space at the bottom third. | O app escreve o nome e a mensagem no espaço livre, com a fonte da marca (Baloo 2), e permite escolher entre 3 molduras. |
| `capa-album` | Capa do álbum | A warm illustrated cover-style portrait of the dog, centered, with a soft decorative frame of small paw prints and leaves around the edges. | Pode virar a capa de qualquer álbum. |

### 10.7 Regras e proteções

- **Nada de marcas, personagens licenciados, artistas vivos ou times reais** em nenhum prompt. Isso já está escrito nos presets.
- **O texto sempre vem do app.** O Gemini nunca escreve texto na imagem; ele erra letras.
- Se o Gemini recusar ou devolver algo fora das regras (sem cachorro, com texto, com outro animal), o job vira `failed` com o código `PROVIDER_REFUSED` ou `QUALITY_REJECTED`, e **o crédito é devolvido**.
  - Fazer uma checagem simples: uma segunda chamada barata ao Gemini, só de texto e visão, perguntando “há um cachorro? há texto escrito?” e respondendo em JSON.
  - Essa checagem **só serve para devolver o crédito**, nunca para julgar a foto do usuário.
- **Moderação da foto de entrada:** respeitar a política do provedor. Se ele bloquear a foto, avisar com respeito: “Não conseguimos usar esta foto. Tente outra em que o cachorro apareça sozinho.”
- **Privacidade:**
  - informar em Sobre/Privacidade que as fotos usadas no Estúdio são enviadas ao Google para gerar a arte;
  - confirmar e documentar a política de retenção da API paga;
  - nunca usar fotos de usuários para outra finalidade.
- **Feature flags por preset:** `enabled: false` desliga um preset sem precisar de deploy de código. Ler de uma tabela `studio_presets` no Supabase ou de variável de ambiente.

### 10.8 Teste de qualidade antes de liberar (o Ivan aprova)

1. Criar o script `scripts/studio-eval.ts`, que roda **todos os presets** com 3 fotos de teste do Abu, colocadas pelo Ivan em `docs/abu-referencias/`, que fica fora do Git.
2. Gerar uma página de revisão `studio-eval.html`, com a foto original e o resultado lado a lado e, para cada preset, o custo, o tempo e se o cachorro ficou reconhecível.
3. O Ivan marca quais presets aprova. Só os aprovados ficam `enabled: true` no lançamento.
4. Registrar no STATUS o custo médio por preset, para definir o preço dos créditos depois.

### 10.9 Aceite

- 4 abas e 28 presets configuráveis.
- O prompt é sempre montado pelo servidor; nenhum campo livre é enviado à IA.
- A figurinha sai com fundo transparente em 512×512 WebP.
- O cartão traz o nome desenhado pelo app, legível e sem erros.
- Recusa ou falha devolve o crédito.
- Desligar um preset o tira do app.
- O teste de qualidade foi executado e os resultados estão no STATUS.
