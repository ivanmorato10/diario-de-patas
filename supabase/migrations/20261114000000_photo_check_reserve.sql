-- Análise paga de foto do Estúdio: reserva atômica antes de chamar a IA — 23/10/2026.
-- Antes: o limite era conferido antes da chamada e o gasto só registrado depois (com resultado válido); chamadas
-- simultâneas passavam do limite e tentativas cobradas sem resultado ficavam fora da conta.
-- Agora cada tentativa paga entra em photo_check_spend ANTES da chamada (com o mesmo trava do teto do dia usado
-- na criação de artes); o resultado continua em photo_checks (cache por foto + recorte, sem custo próprio).
create table if not exists public.photo_check_spend (
  id bigserial primary key,
  requested_by uuid references auth.users (id) on delete set null,
  cost_usd numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists photo_check_spend_by_user_day on public.photo_check_spend (requested_by, created_at);
create index if not exists photo_check_spend_by_day on public.photo_check_spend (created_at);
alter table public.photo_check_spend enable row level security; -- só o servidor

create or replace function public.studio_spent_today_usd() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(cost_usd) from generation_jobs
      where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
        and (state in ('queued', 'processing', 'succeeded') or (state = 'failed' and coalesce(failure_code, '') not in ('NO_CREDITS', 'INPUT_DELETED', 'NOT_CONFIGURED', 'NO_SPACE', 'PHOTO_UNSUITABLE')))), 0)
       + coalesce((select sum(cost_usd) from photo_checks where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'), 0)
       + coalesce((select sum(cost_usd) from photo_check_spend where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'), 0)
$$;

/** true = vaga reservada (dentro do limite por pessoa e do teto do dia); false = segue só com as checagens grátis. */
create or replace function public.reserve_photo_check(p_user uuid, p_cost numeric, p_per_day integer, p_budget_usd numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare used integer;
begin
  perform pg_advisory_xact_lock(hashtext('photo-check:' || p_user));
  if p_budget_usd is not null and p_budget_usd > 0 then perform pg_advisory_xact_lock(hashtext('studio-budget')); end if;
  select count(*) into used from photo_check_spend
    where requested_by = p_user and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if used >= p_per_day then return false; end if;
  if p_budget_usd is not null and p_budget_usd > 0 and studio_spent_today_usd() + p_cost > p_budget_usd then return false; end if;
  insert into photo_check_spend (requested_by, cost_usd) values (p_user, p_cost);
  return true;
end $$;
revoke all on function public.reserve_photo_check(uuid, numeric, integer, numeric) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on function public.reserve_photo_check(uuid, numeric, integer, numeric) from anon, authenticated'; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant execute on function public.reserve_photo_check(uuid, numeric, integer, numeric) to service_role'; end if;
end $$;
