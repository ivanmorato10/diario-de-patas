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
| 9 | Escolher provedor multimodal (doc e preço atuais), adapter servidor, timeout/retries, cota no servidor, métricas de custo | D | decisão |
| 10 | Estado “validação pendente” quando IA indisponível + validar depois | D | 9 |
| 11 | Registro de falsos negativos para ajustar critérios | D | 9 |
| 12 | Provedor de imagem com referência; fila persistente; reserva/consumo/liberação; reconciliação de timeout; histórico; badge “Arte criada com IA”; nome/mensagem renderizados pelo app | E | decisão |
| 13 | Créditos promocionais/teste explícitos | E | 12 |
| 14 | Feature flag de pausa da geração lida do ambiente | E | 12 |
| 15 | Eventos de métricas (§22) com IDs pseudônimos, sem fotos/legendas/nome | F | 3 |
| 16 | Revisão em Safari iOS e Chrome Android reais; leitor de tela | F | — |
| 17 | Termos e política de privacidade adequados ao serviço real | F | 1, 9, 12 |
| 18 | Conversão HEIC (ou manter recusa com instrução) — testar em iPhone | F | 4 |
| 19 | Recorte manual (hoje: girar + `object-fit`) | B+ | — |
| 20 | Exemplos ilustrativos das missões (identificados como exemplo) | B+ | fotos com direitos |

## P1 — após validar o ciclo

Compra real de créditos (webhook assinado, dedupe, estornos); pacotes visuais; retrospectiva animada; notificações opt-in; acessibilidade refinada pós-teste; exportação com fotos (zip); convites familiares; mascote do Abu a partir de fotos.

## P2 — fora desta entrega

Feed público, chat, seguidores, ranking, prêmios em dinheiro, localização ao vivo, diagnóstico, tradução de latidos, múltiplos cachorros na interface, apps nativos, impressão, anúncios, marketplace, venda de dados.
