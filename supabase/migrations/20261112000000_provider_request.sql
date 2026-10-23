-- Parâmetros da cobrança (Pix ou página do Stripe) gravados ANTES da primeira chamada ao provedor — 23/10/2026.
-- Repetir uma tentativa (resposta perdida) manda EXATAMENTE os mesmos parâmetros com a mesma chave de idempotência,
-- e o provedor devolve a mesma cobrança. Antes, o vencimento era recalculado e o Stripe recusava a repetição.
alter table public.credit_purchases add column if not exists provider_request jsonb;
