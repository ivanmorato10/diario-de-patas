# Runbook de operação

> Estado atual: só existe o modo demonstração (sem servidor). Os procedimentos marcados **[Etapa C/D/E]** descrevem o desenho previsto e serão validados quando as integrações existirem — não executar contra produção sem revisão.

## Modo demonstração

- Dados ficam no IndexedDB `diario-de-patas-demo` do navegador do usuário. Não temos acesso a eles.
- Reset: Configurações → Apagar diário (digitar o nome do cachorro). Alternativa: limpar dados do site no navegador.

## Pausar a geração de artes [Etapa E]

1. Definir `GENERATION_PAUSED=true` no ambiente e reimplantar (hoje a flag está em `src/config/business.ts → FLAGS.generationPaused`).
2. Novos jobs são recusados com mensagem; diário, missões e álbuns continuam funcionando.
3. Jobs em andamento terminam ou são reconciliados (abaixo).

## Reconciliar um job travado [Etapa E]

1. `select * from generation_jobs where state in ('queued','processing') and updated_at < now() - interval '15 minutes';`
2. Para cada um, consultar o provedor por `provider_job_id` **antes** de qualquer ação.
3. Concluído no provedor → armazenar resultado, `state='succeeded'`, registrar `consume:<job>`.
4. Falha terminal confirmada → `state='failed'`, registrar `release:<job>`.
5. Ambíguo → não liberar crédito nem criar job duplicado; repetir mais tarde.
As chaves `reserve:/consume:/release:<job_id>` são únicas: repetir o passo é seguro.

## Revogar um link [Etapa C]

`update share_links set revoked_at = now() where id = '<id>' and owner_id = '<owner>';` A rota de mídia revalida o link a cada requisição; URLs assinadas residuais expiram no TTL configurado (documentar o valor ao implementar).

## Exclusão de conta [Etapa C]

1. Marcar entradas `deleted_at`, revogar todos os links, cancelar jobs abertos (reconciliando com o provedor).
2. Job de limpeza remove objetos do bucket (original, exibição, miniatura, artes).
3. `auth.admin.deleteUser` → `on delete cascade` remove o restante.
4. Backups do fornecedor seguem a política dele — não prometer eliminação instantânea.

## Medir custo [Etapa D/E]

- `usage_events` registra `validation`/`generation` com `cost_units` quando o provedor informar.
- Custo por validação: `sum(cost_units)/count(*)` por dia e tipo.
- Margem (§14): receita recebida − taxas − custo de IA − armazenamento/transferência − reembolsos.

## Logs

Nunca registrar imagens, legendas, nome do cachorro, tokens de link, chaves de storage ou credenciais. Erros ao usuário: `code`, mensagem pública e `request_id`.
