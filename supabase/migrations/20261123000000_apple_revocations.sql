-- Revogação do login Apple que falhou na exclusão da conta — 25/10/2026 (App Store 5.1.1(v)).
-- A conta é apagada na hora (a exclusão nunca espera a Apple); o token cifrado fica nesta fila, SEM ligação com a
-- conta (nada de user_id), e a rotina diária tenta revogar de novo. Revogou: a linha é apagada. Depois de 30 dias
-- sem conseguir, a linha também é apagada (o token da Apple não vale mais para nada útil e não deve ficar guardado).
create table if not exists public.apple_revocations (
  id uuid primary key default gen_random_uuid(),
  refresh_token_sealed text not null,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  next_try_at timestamptz not null default now()
);
create index if not exists apple_revocations_due on public.apple_revocations (next_try_at);
alter table public.apple_revocations enable row level security; -- sem política: só o servidor
