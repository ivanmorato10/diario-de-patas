# STATUS — Diário de Patas

Última atualização: **12 de outubro de 2026** · Etapas concluídas: **A** e **B** (seção 25 do briefing)

## Resumo

App web mobile-first navegável, rodando em **modo demonstração**: o diário é criado e guardado no próprio navegador (IndexedDB). O ciclo principal funciona de ponta a ponta — criar diário → missão → foto → confirmar → conquista com XP único → álbum → diário — mas **sem contas, sem IA e sem links reais**, e isso é dito na interface.

**Não está pronto para produção.**

## Implementado

| Item | Situação |
|---|---|
| Arquitetura, estrutura, configuração centralizada | ✅ |
| Identidade v3 a partir do logo do proprietário (Abu lendo o livro): recortes automáticos, paleta do logo, Baloo 2 + Nunito, introdução emocional em 5 passos com animações, movimento nas telas e na conquista — ver docs/BRAND.md | ✅ |
| Boas-vindas, onboarding (nome obrigatório, foto/data/preferências opcionais, fuso confirmado, aviso de privacidade) | ✅ demo |
| Hoje: nível/XP, até 3 sugestões filtradas por preferências, trocar sugestões, progresso do álbum, última lembrança | ✅ demo |
| Catálogo de 12 missões, detalhe, pré-requisito M01, XP único por missão | ✅ demo |
| Envio: câmera/galeria, tipo pelos bytes, limites de bytes e pixels, orientação EXIF, remoção de metadados/GPS, girar, legenda, data civil, cancelar, retry sem duplicar | ✅ demo |
| Resultado aprovado / incerto / limite diário (5/dia) | ✅ demo — confirmação **manual do dono**, rotulada |
| Diário: linha do tempo por mês, filtros, busca, editar, baixar, excluir | ✅ demo |
| Álbuns: 6 coleções, contagem separada de fotos de missão e livres, conquistas | ✅ demo |
| Configurações: perfil, foto, preferências, fuso, uso/limites, exportar JSON, apagar diário | ✅ demo |
| Sobre: história do Abu, explicação do modo demo, suporte sem endereço inventado | ✅ |
| PWA: manifest, ícones, service worker só de assets, página offline | ✅ (instalação não testada em aparelho) |
| Migration Supabase com RLS, funções idempotentes, bucket privado; seed com teste de paridade | ✅ escrito · ⚠️ **não aplicado** |
| Ledger de créditos (reserva/consumo/liberação) | ✅ lógica pura testada |

## Demonstrativo (claramente rotulado no app)

- Validação de missão = confirmação do próprio dono (“Confirmada por você, modo demonstração, sem IA”).
- Cota diária aplicada no navegador (no modo real será no servidor).
- “Já tenho conta” explica que contas ainda não existem.

## Desativado com explicação (não simulado)

- **Estúdio**: fluxo de escolha (foto, tema, custo, saldo 0) visível; botão “Criar desenho” desativado — sem provedor.
- **Compartilhamento**: seleção de fotos funciona; “Criar link” desativado — exige servidor para revogação segura. `/s/:token` sempre mostra mensagem neutra.
- Pagamentos: inexistentes.

## Verificado

- `npm test` — 22 testes (datas civis, sugestões, níveis, regras do validador, ledger, idempotência de XP com requisições simultâneas, limite diário, exclusão, paridade do seed).
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
2. **Escolha do provedor de validação** (Etapa D) e **de imagem com referência** (Etapa E) — vou comparar opções com documentação e preços atuais quando chegar a hora.
3. **Logo**: versão vetorial (SVG) e confirmação de direitos de uso antes do lançamento.
4. Email de suporte real.

## Próximo passo

**Etapa C — dados reais e privacidade:** aplicar migration, repositório Supabase com a mesma interface, autenticação por email, upload para bucket privado com inspeção no servidor, teste de isolamento entre duas contas, compartilhamento revogável e exclusão de conta. O modo demo continua disponível e separado.
