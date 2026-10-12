# Diário de Patas

Diário fotográfico com missões para donos de cachorro. Inspirado no Abu.
*Pequenas aventuras. Memórias para sempre.*

> **Estado:** MVP em construção — Etapas A e B concluídas. Roda em **modo demonstração** (dados só no navegador, sem contas, sem IA). Veja [STATUS.md](./STATUS.md).

## Rodar localmente

Requisitos: Node.js 20.9+ (testado com 22).

```bash
npm install
cp .env.example .env.local   # opcional — sem variáveis roda em modo demo
npm run dev                  # http://localhost:3000
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm test` | Testes unitários (domínio + repositório demo) |
| `npm run typecheck` | TypeScript sem emitir |
| `node scripts/contrast.mjs` | Contraste WCAG das cores usadas |
| `python3 scripts/e2e.py <url> <pasta>` | Teste de fumaça E2E com screenshots (Playwright) |

## Implantação proposta

App Next.js padrão: Vercel, Netlify ou qualquer host Node 20+. **Não publicado** — aguardando decisão do proprietário. Para a Etapa C: criar projeto Supabase, aplicar `supabase/migrations/*` e `supabase/seed.sql` (`supabase db push`), configurar variáveis do `.env.example` no host. A chave `SUPABASE_SERVICE_ROLE_KEY` fica só no servidor.

## Documentação

- [docs/BRIEFING.md](./docs/BRIEFING.md) — briefing completo (referência do projeto)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — decisões, integrações, estrutura
- [docs/BRAND.md](./docs/BRAND.md) — identidade provisória, tokens, mascote
- [docs/TESTING.md](./docs/TESTING.md) — checklist com resultados reais
- [docs/BACKLOG.md](./docs/BACKLOG.md) — P0/P1/P2
- [docs/RUNBOOK.md](./docs/RUNBOOK.md) — operação
