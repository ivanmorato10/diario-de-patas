-- Compra de créditos em dólar (região EUA) pelo Stripe Checkout (20/10/2026).
-- provider_payment_id guarda o id da sessão de pagamento do Stripe (cs_…); checkout_url, o endereço da página
-- de pagamento (para continuar uma compra em andamento). Preço e moeda continuam vindo só do servidor.
alter table public.credit_purchases drop constraint if exists credit_purchases_provider_check;
alter table public.credit_purchases add constraint credit_purchases_provider_check
  check (provider in ('mercadopago', 'stripe', 'teste', 'apple', 'google'));
alter table public.credit_purchases add column if not exists checkout_url text;
