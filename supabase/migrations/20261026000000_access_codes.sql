-- Código de convite para usar o mesmo diário em outro aparelho / com outra pessoa (família, sócia).
-- Só o servidor lê e escreve (sem políticas para usuários). O código é guardado como hash, vale 30 min e uma vez.
create table if not exists public.access_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists access_codes_by_owner on public.access_codes (owner_id, created_at desc);
alter table public.access_codes enable row level security;
