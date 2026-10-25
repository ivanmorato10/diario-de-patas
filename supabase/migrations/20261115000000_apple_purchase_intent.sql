-- Compra da Apple: o diário que vai receber os créditos fica gravado ANTES de abrir a compra — 24/10/2026.
-- Se a confirmação ficar para depois (app fechado no meio), ela usa este diário, e não o que estiver aberto na hora.
create table if not exists public.apple_purchase_intents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.apple_purchase_intents enable row level security; -- só o servidor
