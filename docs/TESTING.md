# Checklist de testes (resultados reais — 12/10/2026, após MUDANCAS-V2 §1–5)

Legenda: ✅ verificado · ⚠️ parcial · ⏸ não verificado (não fingir aprovação)

| Fluxo | Resultado | Como |
|---|---|---|
| Conta/perfil persiste | ⚠️ perfil persiste após recarregar (demo); login real não existe | E2E |
| Contas reais (Supabase na nuvem) | ✅ `scripts/e2e-real.py` 21/21: login por código, cadastro com foto, missão, foto livre, álbum, vacina, PDF, B isolado de A (API e URL), link compartilhado e revogação, sair/entrar, exclusão de conta (0 arquivos restantes) | e2e |
| Importar diário demo para a conta | ✅ 6/6 em duas fases no mesmo navegador + unit (sem duplicar ao repetir) | `scripts/e2e-import.py` |
| Isolamento entre contas | ✅ automatizado em Postgres 16 local com stub de `auth`/`storage` (27 tabelas, funções do servidor, anônimo, link revogado); ⏸ Supabase real (mesmo script com `DATABASE_URL`) | `npm run test:db` |
| Regras de missão no servidor (`confirm_mission`) | ✅ bloqueio sem M01, fora do plano, XP 1x/dia, foto já usada, incerto sem XP, avanço + medalha única, especial 1x/ano | `npm run test:db` |
| Upload inválido/corrompido/orientação | ✅ texto como .jpg recusado; JPEG corrompido tratado; EXIF 6 → retrato | E2E |
| Upload grande (>10 MB) | ✅ documentos (unit); ⚠️ fotos: regra implementada, sem arquivo dedicado | unit |
| Missão confirmada pelo dono: uma conclusão, XP correto, próxima disponível | ✅ | unit + E2E |
| Sem limite diário de missões; XP único | ✅ | unit |
| Concorrência: XP não duplica | ✅ 3 submissões simultâneas → 10 XP | unit (IndexedDB) |
| Concorrência de créditos | ✅ lógica pura; ⏸ SQL | unit |
| “Não tenho certeza” → diário sem prêmio | ✅ | unit |
| Várias fotos de uma vez (data do EXIF, retry sem duplicar) | ✅ 5 fotos → 5 lembranças (unit); 3 fotos → 3 (E2E) | unit + E2E |
| Foto livre do Diário conclui missão sem duplicar | ✅ | unit + E2E |
| Uma foto não pontua em duas missões; arte não conclui missão | ✅ | unit |
| Catálogo 48 missões / 650 XP; níveis alcançáveis; seed = catálogo | ✅ | unit |
| Cuidados: criar, editar e excluir cada tipo; persistir ao recarregar | ✅ | unit + navegador |
| Status de vacinas (limites de 30 dias, fusos SP × Tóquio, dose nova substitui antiga) | ✅ | unit |
| Vacina em 10 dias aparece em Hoje | ✅ | E2E |
| Documentos: PDF real e foto abertos; .pdf falso recusado; validade; excluir | ✅ | unit + E2E |
| Apagar diário remove fotos, cuidados e documentos; não trava com 2 abas | ✅ | unit + navegador |
| Migração do banco local v1→v2→v3→v4 sem perder dados | ✅ v1→v2 e v2→v3 testadas | unit |
| Álbum: fotos livres × conquistas | ✅ | E2E |
| Compartilhamento | ⏸ desativado; `/s/:token` neutro ✅ | E2E |
| IA de arte | ⏸ não configurada; botão desativado ✅ | E2E |
| Datas não mudam de dia | ✅ fusos São Paulo/Tóquio | unit |
| Mobile 360/390 px, desktop sem rolagem horizontal; barra com 5 itens ≥ 44 px | ✅ (Chrome) | E2E |
| Safari iOS / Chrome Android reais | ⏸ | — |
| Leitor de tela real | ⏸ | — |
| Contraste (inclui selos de status e gráfico) | ✅ | `scripts/contrast.mjs` |
| Migrations SQL aplicam em Postgres 16 | ✅ local descartável; ⏸ Supabase | psql |

## Comandos

```bash
npm test                 # unit (Vitest) — 78 testes
npm run test:db          # migrations + seed + RLS + regras de missão (Postgres descartável ou DATABASE_URL)
npm run typecheck
npm run build
node scripts/contrast.mjs
npm run build && npx next start -p 3100 &
python3 scripts/e2e.py http://localhost:3100 e2e-out   # requer: pip install playwright pillow && playwright install chromium
E2E_CHANNEL=chrome python3 scripts/e2e.py …            # ou usa o Google Chrome instalado
```

Último E2E: **56/56** (Chrome 151 headless).
