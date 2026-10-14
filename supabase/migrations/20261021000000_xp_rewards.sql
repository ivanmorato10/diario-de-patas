-- Recompensa por uso: a cada N XP de missões (padrão 200), 1 crédito do Estúdio. Idempotente por marco:
-- o 1º crédito tem a chave xp:<dono>:1, o 2º xp:<dono>:2… — chamar de novo nunca dá em dobro.
create or replace function public.grant_xp_credits(p_owner uuid, p_step integer default 200) returns integer
language plpgsql security definer set search_path = public as $$
declare total integer; milestones integer; added integer := 0; n integer;
begin
  if p_step <= 0 then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('xpcredits:' || p_owner::text));
  select coalesce(sum(x.amount), 0) into total from xp_ledger x join dogs d on d.id = x.dog_id where d.owner_id = p_owner;
  milestones := total / p_step;
  for n in 1..milestones loop
    insert into credit_ledger (owner_id, operation, amount, idempotency_key)
    values (p_owner, 'grant', 1, 'xp:' || p_owner || ':' || n) on conflict (idempotency_key) do nothing;
    if found then added := added + 1; end if;
  end loop;
  return added;
end $$;

revoke all on function public.grant_xp_credits(uuid, integer) from public, anon, authenticated;
