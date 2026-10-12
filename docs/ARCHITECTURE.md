# Arquitetura — Diário de Patas

Referência do produto: [BRIEFING.md](./BRIEFING.md) (fonte de verdade, não editar sem decisão do proprietário).

## Decisões (Etapa A)

1. **Next.js 16 (App Router) + React 19 + TypeScript**, um único repositório, sem microserviços. Pronto para Vercel, Netlify ou qualquer host Node; o destino será escolhido pelo proprietário.
2. **Supabase planejado para Etapa C** (Postgres + Auth por email + Storage em bucket privado). Migration com RLS já escrita em `supabase/migrations/`, **ainda não aplicada**.
3. **Domínio separado da UI** em `src/domain/` (missões, níveis, datas civis, contrato do validador, ledger de créditos), funções puras e testadas.
4. **Repositório por interface**: hoje só existe o `demo-repository` (IndexedDB). O repositório Supabase entra na Etapa C com o mesmo formato de operações; no modo real o servidor é a autoridade de XP, cotas e saldo.
5. **Modo demonstração explícito** (§15): IndexedDB, fotos como `Blob`, banner fixo, reset em Configurações. Nada é apresentado como conta, IA ou link real.
6. **Adapters substituíveis de IA** (`PhotoValidator` e, na Etapa E, `ArtGenerator`). Sem credenciais, o adapter padrão lança `ProviderNotConfiguredError` — nunca aprova sozinho. Provedor será escolhido consultando documentação e preços atuais.
7. **Validação de schema com Zod** na saída do validador; o servidor decide status e XP (`decideStatus`), não o modelo.
8. **Jobs persistentes** para geração (`generation_jobs` + ledger de créditos com reserva/consumo/liberação idempotentes), sem depender de aba aberta.
9. **PWA mínima**: manifest + service worker que guarda apenas assets estáticos e uma página offline; nunca respostas autenticadas ou fotos.
10. **Parâmetros centralizados**: limites, custos e flags em `src/config/business.ts`; catálogo (missões, coleções, níveis, temas) em `src/config/catalog.ts`, espelhado em `supabase/seed.sql` com teste de paridade.

## Integrações necessárias

| Integração | Etapa | Estado |
|---|---|---|
| Supabase (Auth, Postgres, Storage privado) | C | Esquema escrito; projeto não criado; sem credenciais |
| Provedor multimodal para validar fotos | D | Interface + prompt + schema prontos; provedor não escolhido |
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

## Regras que valem em qualquer modo

- XP: uma entrada positiva por conclusão (`unique(completion_id)`); retries devolvem a conclusão existente.
- Data da lembrança é **data civil** (`AAAA-MM-DD`), nunca convertida para UTC.
- Excluir foto remove mídia e vínculos de álbum; conquista e XP permanecem.
- Falha técnica nunca é comunicada como reprovação e não consome cota.
- Legendas são texto puro (React escapa); sem HTML do usuário.

## Créditos (Etapa E)

`disponível = concedido + estornado − reservado + liberado`; `consume` apenas transforma reserva em consumo. Mesma fórmula em `src/domain/credits.ts` e `public.credit_available()`. Reserva serializada por conta (`pg_advisory_xact_lock`).
