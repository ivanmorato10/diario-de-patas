# Arquitetura — Diário de Patas

Referência do produto: [BRIEFING.md](./BRIEFING.md) (fonte de verdade, não editar sem decisão do proprietário).

## Decisões (Etapa A)

1. **Next.js 16 (App Router) + React 19 + TypeScript**, um único repositório, sem microserviços. Pronto para Vercel, Netlify ou qualquer host Node; o destino será escolhido pelo proprietário.
2. **Supabase planejado para Etapa C** (Postgres + Auth por email + Storage em bucket privado). Migration com RLS já escrita em `supabase/migrations/`, **ainda não aplicada**.
3. **Domínio separado da UI** em `src/domain/` (missões, níveis, datas civis, contrato do validador, ledger de créditos), funções puras e testadas.
4. **Repositório por interface**: hoje só existe o `demo-repository` (IndexedDB). O repositório Supabase entra na Etapa C com o mesmo formato de operações; no modo real o servidor é a autoridade de XP, cotas e saldo.
5. **Modo demonstração explícito** (§15): IndexedDB, fotos como `Blob`, banner fixo, reset em Configurações. Nada é apresentado como conta, IA ou link real.
6. **Missões confirmadas pelo dono** (MUDANCAS-V2 §1): quem decide se a foto mostra o critério é o próprio dono (“Sim, mostra” / “Não tenho certeza”, `mode = "owner"`). Não há validação por IA nem limite diário de missões; o XP continua único por missão. **IA só no Estúdio e em sugestões futuras.**
7. **Validador por IA desligado e mantido** (`src/domain/validation.ts`: `PhotoValidator`, schema Zod, `decideStatus`) para o futuro: *sugestão de missão por IA, nunca bloqueio*. Nada no app o chama. O `ArtGenerator` do Estúdio segue o mesmo padrão de adapter substituível.
8. **Jobs persistentes** para geração (`generation_jobs` + ledger de créditos com reserva/consumo/liberação idempotentes), sem depender de aba aberta.
9. **PWA mínima**: manifest + service worker que guarda apenas assets estáticos e uma página offline; nunca respostas autenticadas ou fotos.
10. **Parâmetros centralizados**: limites, custos e flags em `src/config/business.ts`; catálogo (missões, coleções, níveis, temas) em `src/config/catalog.ts`, espelhado em `supabase/seed.sql` com teste de paridade.

## Integrações necessárias

| Integração | Etapa | Estado |
|---|---|---|
| Supabase (Auth, Postgres, Storage privado) | C | Esquema escrito; projeto não criado; sem credenciais |
| ~~Provedor multimodal para validar fotos~~ | ~~D~~ | **Removido** (MUDANCAS-V2 §1). Código mantido desligado para sugestões futuras |
| Provedor de imagem com **referência de foto** | E | Não iniciado; ledger de créditos pronto e testado |
| Pagamentos | P1 | Desativado (`CREDITS.paymentsEnabled = false`) |
| Hospedagem | — | Não publicado (aguarda instrução) |
| Email de suporte | — | Variável `NEXT_PUBLIC_SUPPORT_EMAIL` vazia |

## Estrutura

```
src/
  app/                 rotas (App Router)
    (app)/             telas com navegação inferior: hoje, diario, albuns, estudio, missoes, guardar, config, sobre
    bem-vindo, comecar onboarding
    s/[token]          página compartilhada (hoje: mensagem neutra)
  components/          UI reutilizável (shell, marca, ícones, mídia, seletores)
  config/              parâmetros de negócio e catálogo versionado
  data/                repositório demo (IndexedDB) + provider React
  domain/              regras puras e testadas
  lib/image.ts         inspeção de bytes, limites, EXIF, re-codificação, miniaturas
supabase/              migration + seed (não aplicados)
public/                manifest, service worker, offline, assets de marca provisórios
scripts/               contraste WCAG e teste E2E (Playwright)
```

## Ciclo contínuo de missões (MUDANCAS-V2 §7)

- Tipos: `once` (48 do catálogo), `daily` (36), `collection_item` (15 novos + M reaproveitados), `special` (3). Dados em `src/config/cycle.ts`; regras puras em `src/domain/cycle.ts`.
- Instância que recebe XP: `dog:missão` (única/item), `dog:missão:AAAA-MM-DD` (do dia), `dog:missão:AAAA` (especial). Uma foto rende pontos em uma única instância.
- Plano do dia gravado na primeira abertura (IndexedDB `dailyPlans`; Supabase `daily_plans`), sorteio FNV-1a(cachorro|data|espaço|troca), histórico de 14 dias (ver limitação no STATUS).
- Medalha: verificada na mesma transação da conclusão (IndexedDB) / `award_medal` com chave única + lock (SQL).

## Regras que valem em qualquer modo

- XP: uma entrada positiva por conclusão (`unique(completion_id)`); retries devolvem a conclusão existente.
- Data da lembrança é **data civil** (`AAAA-MM-DD`), nunca convertida para UTC.
- Excluir foto remove mídia e vínculos de álbum; conquista e XP permanecem.
- Falha técnica nunca é comunicada como reprovação.
- Sem limite diário de missões; a confirmação é do dono.
- Legendas são texto puro (React escapa); sem HTML do usuário.

## Créditos (Etapa E)

`disponível = concedido + estornado − reservado + liberado`; `consume` apenas transforma reserva em consumo. Mesma fórmula em `src/domain/credits.ts` e `public.credit_available()`. Reserva serializada por conta (`pg_advisory_xact_lock`).
