# STATUS — Diário de Patas

Última atualização: **12 de outubro de 2026** · Etapas concluídas: **A** e **B** (seção 25 do briefing) · **MUDANCAS-V2** em andamento (ver abaixo)

## MUDANCAS-V2 — progresso

| Seção | Situação |
|---|---|
| 1. Missões confirmadas pelo dono (sem IA) | ✅ |
| 2. Fotos livres, várias de uma vez, usar foto do Diário numa missão | ✅ |
| 3. Catálogo de 48 missões e novos níveis | ✅ |
| 4. Cuidados (ficha de saúde) | ✅ |
| 5. Documentos | ✅ |
| 6. Fechamento 1–5 | ✅ (E2E 56/56) |
| 7. Ciclo contínuo de missões | ✅ (ver limitação dos 14 dias abaixo) |
| 8. Contas reais (Supabase) | ⏳ |
| 9. Estúdio com IA | ⏳ |

## Resumo

App web mobile-first navegável, rodando em **modo demonstração**: o diário é criado e guardado no próprio navegador (IndexedDB). O ciclo principal funciona de ponta a ponta — criar diário → missão → foto → o dono confirma → conquista com XP único → álbum → diário — mas **sem contas e sem links reais**, e isso é dito na interface. Missões são confirmadas pelo dono por decisão de produto (MUDANCAS-V2 §1), não por falta de IA.

**Não está pronto para produção.**

## Implementado

| Item | Situação |
|---|---|
| Arquitetura, estrutura, configuração centralizada | ✅ |
| Identidade v3 a partir do logo do proprietário (Abu lendo o livro): recortes automáticos, paleta do logo, Baloo 2 + Nunito, introdução emocional em 5 passos com animações, movimento nas telas e na conquista — ver docs/BRAND.md | ✅ |
| Boas-vindas, onboarding (nome obrigatório, foto/data/preferências opcionais, fuso confirmado, aviso de privacidade) | ✅ demo |
| Hoje: nível/XP, até 3 sugestões filtradas por preferências, trocar sugestões, progresso do álbum, última lembrança | ✅ demo |
| Catálogo de **48 missões** (650 XP) em 7 coleções com missões + “Datas especiais” só para artes; novas coleções “Estações e datas” e “Cuidados”; pré-requisito M01; XP único por missão; missões externas com alternativa em casa; datas especiais opcionais (fora das sugestões) | ✅ demo |
| **Cuidados** (5º item da navegação): dados do cachorro, peso com histórico e gráfico, vacinas/vermífugos com status pela data (em dia / em até 30 dias / atrasada, com ícone e texto), consultas (+ “Guardar uma foto desta visita” → M47), medicamentos “em uso”, contatos com Ligar e Abrir no mapa; aviso fixo; cartão “Próximos cuidados” em Hoje; banco local v3 com migração sem perda; entra na exportação e é apagado com o diário | ✅ demo |
| **Documentos** em Cuidados: 8 categorias, PDF/JPEG/PNG/WebP até 10 MB validados pelos bytes (`%PDF-` e assinaturas de imagem; texto renomeado .pdf é recusado), imagens processadas como fotos (EXIF, sem metadados, miniatura), PDF guardado como está; ver em nova aba (blob URL), baixar, editar, excluir com confirmação; limite de 50; validade “vence em breve”/“vencido” também em Próximos cuidados; foto da etiqueta da vacina e anexos de consulta viram documentos; nunca entram no Diário, Álbuns ou links | ✅ demo |
| Migration `20261014000000_documents.sql` (tabela + bucket privado separado `documents` + cota de 50 + vínculos) | ✅ aplicada e testada em Postgres local descartável; ⚠️ não aplicada no Supabase |
| Migration `20261013000000_health.sql` com RLS por dono | ✅ aplicada e testada num Postgres 16 local descartável (stub de `auth`); ⚠️ não aplicada no Supabase |
| **Missões do dia**: 3 por dia (casa e descanso · companhia e brincadeira · passeio ou retrato), sorteio determinístico por hash(cachorro + data), plano gravado na primeira abertura do dia (fuso do usuário), “Trocar” gratuito e persistente, “2 de 3 hoje”, cartão “Aventuras de hoje concluídas!” com patinhas; 10 XP por dia sorteado; respeita preferências (sem passeio → retrato; encontro na rua só com outros cães) | ✅ demo |
| **Coleções permanentes** (5 × 6, aba “Coleções” em Álbuns): itens reaproveitam M17, M30, M24… (conclusões antigas contam), missão do dia ligada avança item sem XP extra, medalha + 50 XP uma única vez (testado com requisições simultâneas), capa especial em canvas (sem IA) para baixar, sugestão da próxima | ✅ demo |
| **Especiais** (aniversário ±7 dias com data informada, Natal 1–26/12, Halloween 24–31/10): cartão em Hoje só na janela, 20 XP uma vez por ano, “Transformar em arte de …?” leva ao Estúdio com tema e foto escolhidos | ✅ demo |
| Níveis sem fim (“Sempre juntos II, III…” a cada 250 XP), dias com lembranças (sem sequência) e número de medalhas em Hoje | ✅ |
| Migration `20261015000000_cycle.sql` (tipos de missão, `daily_plans`, avanços, medalhas, `award_medal` idempotente) + seed das 102 missões com teste de paridade | ✅ aplicada em Postgres local descartável; ⚠️ não aplicada no Supabase |
| 7 níveis (0 → 500 XP, “Sempre juntos”), todos alcançáveis pelo catálogo (teste) | ✅ |
| Lista de missões agrupada por coleção com filtro “Disponíveis / Concluídas” | ✅ demo |
| Envio: câmera/galeria, tipo pelos bytes, limites de bytes e pixels, orientação EXIF, remoção de metadados/GPS, girar, legenda, data civil, cancelar, retry sem duplicar | ✅ demo |
| Várias fotos de uma vez (galeria `multiple`): legenda e data por foto, data lida do EXIF (JPEG/PNG/WebP) ou hoje, “Guardar todas”, mostra quantas cabem, retry do lote sem duplicar | ✅ demo |
| “Usar numa missão” no Diário: foto livre conclui missão depois, sem novo upload; aviso se a missão já foi concluída; arte nunca conclui missão; uma foto pontua em uma única missão | ✅ demo |
| Confirmação da missão pelo dono (“Sim, mostra” / “Não tenho certeza”) — **modo oficial**, “Confirmada por você”; sem limite diário | ✅ |
| Diário: linha do tempo por mês, filtros, busca, editar, baixar, excluir | ✅ demo |
| Álbuns: 6 coleções, contagem separada de fotos de missão e livres, conquistas | ✅ demo |
| Configurações: perfil, foto, preferências, fuso, uso/limites, exportar JSON, apagar diário (não trava com várias abas) | ✅ demo |
| Banco local versionado (v2 remove o contador de validações) com migração sem perda de dados | ✅ testado |
| Sobre: história do Abu, explicação do modo demo, suporte sem endereço inventado | ✅ |
| PWA: manifest, ícones, service worker só de assets, página offline | ✅ (instalação não testada em aparelho) |
| Migration Supabase com RLS, funções idempotentes, bucket privado; seed com teste de paridade | ✅ escrito · ⚠️ **não aplicado** |
| Ledger de créditos (reserva/consumo/liberação) | ✅ lógica pura testada |

## Demonstrativo (claramente rotulado no app)

- “Já tenho conta” explica que contas ainda não existem.

## Desativado com explicação (não simulado)

- **Estúdio**: fluxo de escolha (foto, tema, custo, saldo 0) visível; botão “Criar desenho” desativado — sem provedor.
- **Compartilhamento**: seleção de fotos funciona; “Criar link” desativado — exige servidor para revogação segura. `/s/:token` sempre mostra mensagem neutra.
- Pagamentos: inexistentes.

## Verificado

- `npm test` — 77 testes (inclui ciclo: plano igual ao recarregar, troca persiste, virada SP × Tóquio, sem repetição enquanto houver opção, preferências, XP por dia sorteado, foto não pontua duas vezes, especiais só na janela e uma vez por ano, avanço de coleção sem XP, medalha única com requisições simultâneas, M24 antigo conta, níveis sem fim, seed do ciclo = cycle.ts)
- E2E **60/60** após §7 (inclui missões do dia, troca persistente e aba Coleções)
- `npm test` (até §5) — 57 testes (inclui documentos: assinatura de PDF, texto renomeado recusado, limite de tamanho, vínculos removidos ao excluir, cota de 50, não entram no diário, reset, validade em Próximos cuidados)
- Navegador (Chrome, 390 px) da §5: PDF real e foto enviados e abertos em nova aba (application/pdf e image/webp), .pdf falso recusado, aviso de validade em Documentos e em Hoje, excluir, etiqueta da vacina
- `npm test` (até §4) — 48 testes (inclui cuidados: status de vacinas com limites e fusos SP/Tóquio, dose nova substitui a antiga, próximos cuidados, medicamentos em uso, CRUD de cada tipo, persistência, reset, migração v2→v3)
- Navegador (Chrome, 360 px) da §4: 5 itens na barra (72×66 px), vacina em 10 dias aparece em Hoje, gráfico e tabela de peso, Ligar/mapa, editar/excluir, sem rolagem horizontal, sem erros
- `npm test` (até §3) — 35 testes (inclui catálogo v2: 48 missões, 650 XP, níveis alcançáveis, alternativas em casa, opcionais nunca pré-requisito, seed = catálogo)
- `npm test` (até §2) — 31 testes (datas civis, sugestões, níveis, regras do validador desligado, ledger, idempotência de XP com requisições simultâneas, sem limite diário, migração v1→v2, exclusão e reset com outra aba aberta, paridade do seed, data do EXIF em JPEG/PNG/WebP, lote de 5 fotos, foto livre → missão, foto não pontua duas vezes, arte não conclui missão).
- Verificação no navegador (Chrome, 390 px) da seção 2: 5 fotos → 5 lembranças, data do EXIF preenchida, “Usar numa missão” conclui “Olá, mundo” sem duplicar a foto.
- `npm run typecheck` e `npm run build` — sem erros.
- `node scripts/contrast.mjs` — contraste de todas as combinações usadas.
- `scripts/e2e.py` (Chrome headless, 390 px, 360 px e 1280 px) — **56/56**: fluxo completo, EXIF, arquivo falso e corrompido, persistência, várias fotos de uma vez, foto do Diário numa missão, 48 missões e filtro, vacina em 10 dias em Hoje, PDF enviado e aberto, PDF falso recusado, todas as telas de Cuidados sem rolagem horizontal, barra de 5 itens ≥ 44 px em 360 px, sem erros de console, apagar diário. Detalhes em docs/TESTING.md.

## Limitação conhecida (§7)

**“Nada se repete em 14 dias”** não é possível com o banco atual: cada espaço tem 12 missões do dia (o espaço C para quem não passeia tem 6 retratos) e uma é sugerida por dia. O app não repete enquanto houver opção no espaço; esgotado, volta a mais antiga. Para cumprir 14 dias à risca, cada espaço precisa de **pelo menos 15 missões** (decisão de conteúdo do proprietário).

## Não verificado

- Safari iOS e Chrome Android reais (câmera, galeria, teclado, instalação PWA).
- Leitores de tela reais (VoiceOver/TalkBack) — só semântica e rótulos revisados.
- Migration SQL contra Postgres/Supabase.
- Fotos HEIC: recusadas com instrução clara; conversão não implementada.

## Bloqueado (precisa do proprietário)

1. **Projeto Supabase** (URL + anon key + service role) para a Etapa C.
2. **Escolha do provedor de imagem com referência** (Estúdio, MUDANCAS-V2 §9) — vou comparar opções com documentação e preços atuais quando chegar a hora. Validação de fotos por IA foi **removida** do plano (§1).
3. **Logo**: versão vetorial (SVG) e confirmação de direitos de uso antes do lançamento.
4. Email de suporte real.

## Próximo passo

MUDANCAS-V2 §8 (Supabase — precisa de Docker e do projeto na nuvem) e §9 (Estúdio — precisa da escolha do provedor e da chave).

Anterior:

**Etapa C — dados reais e privacidade:** aplicar migration, repositório Supabase com a mesma interface, autenticação por email, upload para bucket privado com inspeção no servidor, teste de isolamento entre duas contas, compartilhamento revogável e exclusão de conta. O modo demo continua disponível e separado.
