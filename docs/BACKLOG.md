# Backlog priorizado

## P0 — MVP funcional (pendentes)

| # | Item | Etapa | Depende de |
|---|---|---|---|
| 1 | Projeto Supabase, aplicar migration + seed, testar RLS | C | credenciais |
| 2 | Auth por email (magic link/OTP), cookies SameSite, middleware de sessão | C | 1 |
| 3 | Repositório Supabase com a interface do demo | C | 1 |
| 4 | Upload: URL assinada de upload → inspeção de bytes no servidor (sharp: tipo real, pixels, EXIF, remoção de metadados, variantes) → status `ready` | C | 1 |
| 5 | Limpeza programada de uploads órfãos | C | 4 |
| 6 | Teste de isolamento duas contas (registros, assets, jobs por URL/ID) | C | 3 |
| 7 | Compartilhamento: token aleatório + hash, snapshot da seleção, rota de mídia que revalida, revogação, `noindex`, aviso de cópia | C | 3 |
| 8 | Exclusão de conta: bloquear leitura, revogar links, cancelar jobs, apagar objetos por job | C | 3 |
| ~~9–11~~ | ~~Validação de fotos por IA~~ — **removida** (MUDANCAS-V2 §1). Futuro opcional: sugestão de missão por IA, nunca bloqueio | — | — |
| 12 | Provedor de imagem com referência; fila persistente; reserva/consumo/liberação; reconciliação de timeout; histórico; badge “Arte criada com IA”; nome/mensagem renderizados pelo app | E | decisão |
| 13 | Créditos promocionais/teste explícitos | E | 12 |
| 14 | Feature flag de pausa da geração lida do ambiente | E | 12 |
| 15 | Eventos de métricas (§22) com IDs pseudônimos, sem fotos/legendas/nome | F | 3 |
| 16 | Revisão em Safari iOS e Chrome Android reais; leitor de tela | F | — |
| 17 | Termos e política de privacidade adequados ao serviço real | F | 1, 9, 12 |
| 18 | Conversão HEIC (ou manter recusa com instrução) — testar em iPhone | F | 4 |
| 19 | Recorte manual (hoje: girar + `object-fit`) | B+ | — |
| 20 | Exemplos ilustrativos das missões (identificados como exemplo) | B+ | fotos com direitos |

## MUDANCAS-V2 — pendentes

| # | Item | Seção |
|---|---|---|
| 21 | Ciclo contínuo: missões do dia, coleções permanentes, especiais, níveis sem fim | 7 |
| 22 | Contas reais com Supabase (auth, repositório, upload com `sharp`, import do demo, links revogáveis, exclusão de conta, teste de RLS automatizado) | 8 |
| 23 | Estúdio com IA (pesquisa de provedores → escolha do proprietário → adapter, jobs, créditos de teste, limites) | 9 |
| 24 | Repositório Supabase para cuidados e documentos (bucket `documents`) | 8 |

## P1 — após validar o ciclo

Notificações push de cuidados (hoje só lembretes dentro do app); exportação com os arquivos de documentos (zip); compra real de créditos (webhook assinado, dedupe, estornos); pacotes visuais; retrospectiva animada; notificações opt-in; acessibilidade refinada pós-teste; exportação com fotos (zip); convites familiares; mascote do Abu a partir de fotos.

## P2 — fora desta entrega

Feed público, chat, seguidores, ranking, prêmios em dinheiro, localização ao vivo, diagnóstico, tradução de latidos, múltiplos cachorros na interface, apps nativos, impressão, anúncios, marketplace, venda de dados.
