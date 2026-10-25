-- Compra da Apple: uma intenção POR TENTATIVA, imutável — 25/10/2026.
-- Antes havia uma linha por pessoa (o último diário escolhido): uma 2ª tentativa (ou outro aparelho) trocava o destino
-- de uma compra anterior ainda sem confirmação. Agora cada tentativa ganha um id próprio, que vai para a Apple como
-- appAccountToken; a transação assinada pela Apple traz esse id de volta e os créditos vão para o diário DAQUELA
-- tentativa. Diário apagado (dog_id vira nulo) = pendência explícita, nunca outro diário em silêncio.
create table if not exists public.apple_purchase_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid references public.dogs (id) on delete set null,
  created_at timestamptz not null default now(),
  transaction_id text unique
);
create index if not exists apple_purchase_attempts_user on public.apple_purchase_attempts (user_id, created_at desc);
alter table public.apple_purchase_attempts enable row level security; -- sem política: só o servidor
-- apple_purchase_intents (uma linha por pessoa) deixa de ser usada; removida numa migration seguinte, depois do deploy.
