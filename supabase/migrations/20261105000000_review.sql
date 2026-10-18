-- Revisão de 18/10/2026: boas-vindas à prova de edição do perfil, vaga reservada para arte,
-- custo das análises de foto no teto do dia e comprovante de compra com tentativa de novo.

-- 4) Boas-vindas: o controle sai de profiles.welcome_credits_at (a pessoa pode editar o próprio perfil) e vai para
--    uma tabela só do servidor. Apagar o diário (o extrato vai junto) ou mexer no perfil não repete o presente.
create table if not exists public.welcome_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dog_id uuid,
  amount integer not null,
  granted_at timestamptz not null default now()
);
alter table public.welcome_grants enable row level security; -- sem políticas: ninguém além do servidor
insert into public.welcome_grants (user_id, amount, granted_at)
  select p.user_id, 0, p.welcome_credits_at from public.profiles p
  where p.welcome_credits_at is not null and exists (select 1 from auth.users u where u.id = p.user_id)
  on conflict do nothing;
insert into public.welcome_grants (user_id, dog_id, amount, granted_at)
  select c.owner_id, c.dog_id, c.amount, c.created_at from public.credit_ledger c
  where c.idempotency_key like 'welcome:%' and c.owner_id is not null
  on conflict do nothing;

create or replace function public.grant_welcome_credits(p_owner uuid, p_dog uuid, p_amount integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_amount <= 0 then return; end if;
  insert into welcome_grants (user_id, dog_id, amount) values (p_owner, p_dog, p_amount) on conflict (user_id) do nothing;
  if not found then return; end if; -- já recebeu (em qualquer diário)
  insert into credit_ledger (owner_id, dog_id, operation, amount, idempotency_key)
    values (p_owner, p_dog, 'grant', p_amount, 'welcome:' || p_owner || ':' || p_dog) on conflict (idempotency_key) do nothing;
  insert into profiles (user_id, welcome_credits_at) values (p_owner, now())
    on conflict (user_id) do update set welcome_credits_at = coalesce(profiles.welcome_credits_at, now()); -- só informativo
end $$;

-- 7) Toda lembrança nova respeita as vagas reservadas por artes em andamento.
--    A própria arte usa a sua vaga (a lembrança do Estúdio tem request_key = id do pedido).
create or replace function public.enforce_entry_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim integer; n integer; reserved integer;
begin
  perform pg_advisory_xact_lock(hashtext('entries:' || new.dog_id));
  select value into lim from app_limits where key = 'max_entries';
  select count(*) into n from diary_entries where dog_id = new.dog_id and deleted_at is null;
  select count(*) into reserved from generation_jobs
    where dog_id = new.dog_id and state in ('queued', 'processing')
      and not (new.source = 'studio' and id = new.request_key);
  if n + reserved >= coalesce(lim, 100) then raise exception 'STORAGE_QUOTA' using errcode = 'P0001'; end if;
  return new;
end $$;

-- 6) Análises de foto (IA barata): guardadas por foto + recorte (a mesma análise não é paga duas vezes)
--    e somadas ao teto de gasto do dia. Só o servidor lê e escreve.
create table if not exists public.photo_checks (
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  crop_key text not null,
  result jsonb not null,
  cost_usd numeric not null default 0,
  requested_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (asset_id, crop_key)
);
create index if not exists photo_checks_by_user_day on public.photo_checks (requested_by, created_at);
create index if not exists photo_checks_by_day on public.photo_checks (created_at);
alter table public.photo_checks enable row level security; -- sem políticas: ninguém além do servidor

create or replace function public.studio_spent_today_usd() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(cost_usd) from generation_jobs
      where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
        and (state in ('queued', 'processing', 'succeeded') or (state = 'failed' and coalesce(failure_code, '') not in ('NO_CREDITS', 'INPUT_DELETED', 'NOT_CONFIGURED', 'NO_SPACE', 'PHOTO_UNSUITABLE')))), 0)
       + coalesce((select sum(cost_usd) from photo_checks where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'), 0)
$$;

create or replace function public.create_studio_job(p_job jsonb, p_max_entries integer, p_budget_usd numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare d uuid := (p_job ->> 'dog_id')::uuid; existing uuid; used integer; new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('entries:' || d));
  if p_budget_usd is not null and p_budget_usd > 0 then perform pg_advisory_xact_lock(hashtext('studio-budget')); end if;
  select id into existing from generation_jobs where owner_id = (p_job ->> 'owner_id')::uuid and idempotency_key = (p_job ->> 'idempotency_key')::uuid;
  if found then return existing; end if;
  select (select count(*) from diary_entries where dog_id = d and deleted_at is null)
       + (select count(*) from generation_jobs where dog_id = d and state in ('queued', 'processing')) into used;
  if used >= p_max_entries then raise exception 'NO_SPACE'; end if;
  if p_budget_usd is not null and p_budget_usd > 0
     and studio_spent_today_usd() + coalesce((p_job ->> 'cost_usd')::numeric, 0) > p_budget_usd then
    raise exception 'BUDGET';
  end if;
  insert into generation_jobs (owner_id, dog_id, requested_by, input_entry_id, input_asset_id, theme_id, preset_version, aspect, crop, overlay, model, credits, cost_usd, idempotency_key)
    select r.owner_id, r.dog_id, r.requested_by, r.input_entry_id, r.input_asset_id, r.theme_id, r.preset_version, r.aspect, r.crop, r.overlay, r.model, r.credits, r.cost_usd, r.idempotency_key
    from jsonb_populate_record(null::generation_jobs, p_job) r
    returning id into new_id;
  return new_id;
end $$;

-- 8) Comprovante: "enviando" (reserva com prazo) separado de "enviado"; falha no envio volta para a fila.
alter table public.credit_purchases add column if not exists receipt_claimed_at timestamptz;

revoke all on function public.grant_welcome_credits(uuid, uuid, integer), public.create_studio_job(jsonb, integer, numeric), public.studio_spent_today_usd()
  from public, anon, authenticated;
