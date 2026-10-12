# Checklist de testes (resultados reais — 12/10/2026)

Legenda: ✅ verificado · ⚠️ parcial · ⏸ não verificado (não fingir aprovação)

| Fluxo (§23) | Resultado | Como |
|---|---|---|
| Conta/perfil persiste | ⚠️ perfil persiste após recarregar (demo); login real não existe | E2E |
| Isolamento entre contas | ⏸ Etapa C | — |
| Upload inválido/corrompido/orientação | ✅ texto como .jpg recusado; JPEG corrompido tratado; EXIF 6 → retrato | E2E |
| Upload grande (>10 MB, pixels) | ⚠️ regra implementada, sem arquivo de teste dedicado | código |
| Missão aprovada: uma conclusão, XP correto, próxima disponível | ✅ | unit + E2E |
| Concorrência: XP não duplica | ✅ 3 submissões simultâneas → 10 XP | unit (IndexedDB) |
| Concorrência de créditos | ✅ lógica pura; ⏸ SQL | unit |
| Resultado incerto → diário sem prêmio | ✅ | unit |
| Limite diário | ✅ no cliente (demo); ⏸ no servidor | unit |
| Álbum: fotos livres × conquistas | ✅ “0 de missão · 1 livres” | E2E |
| Compartilhamento | ⏸ desativado; `/s/:token` neutro ✅ | E2E |
| IA de arte | ⏸ não configurada; botão desativado ✅ | E2E |
| Exclusão: some da UI e do álbum, conquista fica | ✅ | unit + E2E |
| Datas não mudam de dia | ✅ fusos São Paulo/Tóquio | unit |
| Modo demo identificado | ✅ banner + rótulos | E2E |
| Mobile 360/390 px, desktop | ✅ sem rolagem horizontal (Chromium) | E2E |
| Safari iOS / Chrome Android reais | ⏸ | — |
| Leitor de tela real | ⏸ | — |
| Contraste | ✅ | `scripts/contrast.mjs` |
| Seed SQL = catálogo | ✅ | unit |

## Comandos

```bash
npm test                 # unit (Vitest)
npm run typecheck
npm run build
node scripts/contrast.mjs
npm run build && npx next start -p 3100 &
python3 scripts/e2e.py http://localhost:3100 e2e-out   # requer: pip install playwright pillow && playwright install chromium
```
