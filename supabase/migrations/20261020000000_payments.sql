-- Diário de Patas — compra de créditos (Pix via Mercado Pago; pronto para outras origens, ex.: compra no app).
-- O dinheiro nunca passa por aqui: só o registro da compra e a concessão idempotente dos créditos.

create table if not exists public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  package_id text not null,
  credits integer not null check (credits between 1 and 1000),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'BRL',
  provider text not null check (provider in ('mercadopago', 'teste', 'apple', 'google')),
  provider_payment_id text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled', 'refunded')),
  pix_qr text,             -- Pix copia e cola
  pix_qr_base64 text,      -- imagem do QR (PNG em base64)
  expires_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (provider, provider_payment_id)
);
create index if not exists purchases_by_owner on public.credit_purchases (owner_id, created_at desc);

alter table public.credit_purchases enable row level security;
-- O dono só lê as próprias compras; criar e atualizar é só pelo servidor (service role).
create policy own_purchases_read on public.credit_purchases for select using (owner_id = (select auth.uid()));

-- Concede os créditos de uma compra aprovada UMA única vez (webhook e consulta podem chegar juntos).
create or replace function public.grant_purchase_credits(p_purchase uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare p public.credit_purchases;
begin
  perform pg_advisory_xact_lock(hashtext('purchase:' || p_purchase::text));
  select * into p from credit_purchases where id = p_purchase;
  if not found or p.status <> 'approved' then return false; end if;
  insert into credit_ledger (owner_id, operation, amount, payment_id, idempotency_key)
  values (p.owner_id, 'grant', p.credits, p.provider || ':' || coalesce(p.provider_payment_id, p.id::text), 'purchase:' || p.id)
  on conflict (idempotency_key) do nothing;
  return found;
end $$;

revoke all on function public.grant_purchase_credits(uuid) from public, anon, authenticated;
