-- Entrar com Apple: token de atualização da Apple guardado (cifrado pelo servidor) para REVOGAR a autorização na
-- Apple quando a pessoa exclui a conta — 25/10/2026 (App Store 5.1.1(v)). O Supabase não revoga sozinho.
-- Apagar a conta apaga a linha (cascata). Sem política: só o servidor lê.
create table if not exists public.apple_signin_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token_sealed text not null,
  updated_at timestamptz not null default now()
);
alter table public.apple_signin_tokens enable row level security;
