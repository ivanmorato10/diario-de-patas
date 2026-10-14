-- XP do mês (MUDANCAS: recompensa mensal). Dois contadores:
--  * XP total: soma de tudo (níveis e conquistas), nunca zera — continua sendo a soma de xp_ledger.
--  * XP do mês: pontos ganhos no mês civil de America/Sao_Paulo (fuso fixo para todas as contas).
-- Ao chegar a p_goal no mês, 1 crédito de arte, no máximo uma vez por conta e mês (chave xp-month:<dono>:<AAAA-MM>).
-- Pontos excedentes não passam para o mês seguinte; créditos já ganhos ficam. A mesma conclusão de missão
-- nunca pontua duas vezes (xp_ledger.completion_id é único).
create or replace function public.monthly_xp(p_owner uuid, p_month text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(x.amount), 0)::int from xp_ledger x join dogs d on d.id = x.dog_id
  where d.owner_id = p_owner and to_char(x.created_at at time zone 'America/Sao_Paulo', 'YYYY-MM') = p_month
$$;

create or replace function public.grant_monthly_xp_credit(p_owner uuid, p_goal integer default 200, p_month text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare m text := coalesce(p_month, to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM'));
begin
  if p_goal <= 0 or monthly_xp(p_owner, m) < p_goal then return false; end if;
  insert into credit_ledger (owner_id, operation, amount, idempotency_key)
  values (p_owner, 'grant', 1, 'xp-month:' || p_owner || ':' || m) on conflict (idempotency_key) do nothing;
  return found;
end $$;

revoke all on function public.monthly_xp(uuid, text) from public, anon, authenticated;
revoke all on function public.grant_monthly_xp_credit(uuid, integer, text) from public, anon, authenticated;
