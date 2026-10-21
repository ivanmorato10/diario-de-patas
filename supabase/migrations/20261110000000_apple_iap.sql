-- Compra de créditos pela Apple (app da App Store) — 21/10/2026.
-- provider 'apple' já era aceito; provider_payment_id = transactionId da Apple (único por provedor: a mesma
-- transação nunca entrega créditos duas vezes). sandbox = compra de teste (TestFlight/sandbox da Apple).
alter table public.credit_purchases add column if not exists sandbox boolean not null default false;
