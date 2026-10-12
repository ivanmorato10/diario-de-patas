# STATUS — Diário de Patas

Última atualização: **12 de outubro de 2026** · Etapas concluídas: **A** e **B** (seção 25 do briefing) · **MUDANCAS-V2** em andamento (ver abaixo)

## MUDANCAS-V2 — progresso

| Seção | Situação |
|---|---|
| 1. Missões confirmadas pelo dono (sem IA) | ✅ |
| 2. Fotos livres, várias de uma vez, usar foto do Diário numa missão | ✅ |
| 3. Catálogo de 48 missões e novos níveis | ✅ |
| 4. Cuidados (ficha de saúde) | ⏳ |
| 5. Documentos | ⏳ |
| 6. Fechamento 1–5 | ⏳ |
| 7. Ciclo contínuo de missões | ⏳ |
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

- `npm test` — 35 testes (inclui catálogo v2: 48 missões, 650 XP, níveis alcançáveis, alternativas em casa, opcionais nunca pré-requisito, seed = catálogo)
- `npm test` (até §2) — 31 testes (datas civis, sugestões, níveis, regras do validador desligado, ledger, idempotência de XP com requisições simultâneas, sem limite diário, migração v1→v2, exclusão e reset com outra aba aberta, paridade do seed, data do EXIF em JPEG/PNG/WebP, lote de 5 fotos, foto livre → missão, foto não pontua duas vezes, arte não conclui missão).
- Verificação no navegador (Chrome, 390 px) da seção 2: 5 fotos → 5 lembranças, data do EXIF preenchida, “Usar numa missão” conclui “Olá, mundo” sem duplicar a foto.
- `npm run typecheck` e `npm run build` — sem erros.
- `node scripts/contrast.mjs` — contraste de todas as combinações usadas.
- `scripts/e2e.py` (Chromium headless, 390 px, 360 px e 1280 px) — 28/28: fluxo completo, EXIF, arquivo falso e corrompido, persistência após recarregar, sem rolagem horizontal, sem erros de console, apagar diário.

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

**Etapa C — dados reais e privacidade:** aplicar migration, repositório Supabase com a mesma interface, autenticação por email, upload para bucket privado com inspeção no servidor, teste de isolamento entre duas contas, compartilhamento revogável e exclusão de conta. O modo demo continua disponível e separado.
