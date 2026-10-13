-- Diário de Patas — Estúdio com IA (MUDANCAS-V2 §9 e adendo §10). Sem cobrança real: só créditos de teste.

-- Jobs: o que foi pedido (preset + versão do prompt), com qual modelo, quanto custou e quando.
alter table public.generation_jobs
  drop constraint if exists generation_jobs_theme_id_check,
  add column if not exists dog_id uuid references public.dogs (id) on delete cascade,
  add column if not exists input_entry_id uuid references public.diary_entries (id) on delete set null,
  add column if not exists preset_version integer not null default 1,
  add column if not exists aspect text not null default '1:1' check (aspect in ('1:1', '4:5', '9:16')),
  add column if not exists crop jsonb,                 -- recorte manual normalizado {x,y,w,h} (0..1)
  add column if not exists overlay jsonb,              -- nome/mensagem/moldura desenhados pelo app
  add column if not exists model text,
  add column if not exists credits integer not null default 1 check (credits between 1 and 10),
  add column if not exists cost_usd numeric(10, 5),
  add column if not exists output_entry_id uuid references public.diary_entries (id) on delete set null,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;
-- theme_id passa a guardar o id do preset (28 presets, validados pelo servidor).
create index if not exists jobs_by_owner on public.generation_jobs (owner_id, created_at desc);
create index if not exists jobs_by_day on public.generation_jobs (created_at) where state <> 'cancelled';

-- Presets ligados/desligados sem deploy (§10.7). Linha ausente = vale o padrão do código.
create table if not exists public.studio_presets (
  id text primary key,
  enabled boolean not null default true,
  credits integer check (credits between 1 and 10),
  updated_at timestamptz not null default now()
);
alter table public.studio_presets enable row level security;
create policy studio_presets_read on public.studio_presets for select using (true);

-- Créditos de teste: concedidos uma única vez por conta (idempotência pela chave).
create or replace function public.grant_test_credits(p_owner uuid, p_amount integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_amount <= 0 then return; end if;
  insert into credit_ledger (owner_id, operation, amount, idempotency_key)
  values (p_owner, 'grant', p_amount, 'grant:test:' || p_owner) on conflict (idempotency_key) do nothing;
end $$;

-- Consumo só depois de salvar o resultado; liberação só em falha confirmada. Ambos idempotentes
-- e mutuamente exclusivos (uma reserva vira consumo OU liberação, nunca os dois).
create or replace function public.settle_credit(p_job uuid, p_op text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.credit_ledger;
begin
  if p_op not in ('consume', 'release') then raise exception 'BAD_OP'; end if;
  select * into r from credit_ledger where idempotency_key = 'reserve:' || p_job;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtext('job:' || p_job::text));
  if exists (select 1 from credit_ledger where idempotency_key in ('consume:' || p_job, 'release:' || p_job)) then return false; end if;
  insert into credit_ledger (owner_id, job_id, operation, amount, idempotency_key) values (r.owner_id, p_job, p_op, r.amount, p_op || ':' || p_job);
  return true;
end $$;

revoke all on function public.grant_test_credits(uuid, integer) from public, anon, authenticated;
revoke all on function public.settle_credit(uuid, text) from public, anon, authenticated;
