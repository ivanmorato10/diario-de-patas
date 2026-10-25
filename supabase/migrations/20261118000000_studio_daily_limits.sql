-- Estúdio: limites diários (por cachorro e geral) conferidos DENTRO da criação do job, com trava — 24/10/2026.
-- Antes eram contados no servidor antes de chamar create_studio_job: dois pedidos ao mesmo tempo passavam pela mesma
-- contagem, e um erro na contagem virava "zero". Agora contagem e criação acontecem juntas, sob trava.
-- (A versão antiga, de 3 parâmetros, continua existindo só para a transição da publicação.)
create or replace function public.create_studio_job(p_job jsonb, p_max_entries integer, p_budget_usd numeric, p_max_per_dog integer, p_max_global integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare d uuid := (p_job ->> 'dog_id')::uuid; existing uuid; used integer; n integer; new_id uuid;
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  perform pg_advisory_xact_lock(hashtext('entries:' || d));
  if p_max_global is not null then perform pg_advisory_xact_lock(hashtext('studio-daily')); end if;
  if p_budget_usd is not null and p_budget_usd > 0 then perform pg_advisory_xact_lock(hashtext('studio-budget')); end if;
  select id into existing from generation_jobs where owner_id = (p_job ->> 'owner_id')::uuid and idempotency_key = (p_job ->> 'idempotency_key')::uuid;
  if found then return existing; end if; -- repetição: o mesmo pedido (antes dos limites)
  if p_max_per_dog is not null then
    select count(*) into n from generation_jobs where dog_id = d and created_at >= day_start and (failure_code is null or failure_code <> 'NO_CREDITS');
    if n >= p_max_per_dog then raise exception 'DAILY_LIMIT'; end if;
  end if;
  if p_max_global is not null then
    select count(*) into n from generation_jobs where created_at >= day_start and (failure_code is null or failure_code <> 'NO_CREDITS');
    if n >= p_max_global then raise exception 'GLOBAL_LIMIT'; end if;
  end if;
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
revoke all on function public.create_studio_job(jsonb, integer, numeric, integer, integer) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on function public.create_studio_job(jsonb, integer, numeric, integer, integer) from anon, authenticated'; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant execute on function public.create_studio_job(jsonb, integer, numeric, integer, integer) to service_role'; end if;
end $$;
