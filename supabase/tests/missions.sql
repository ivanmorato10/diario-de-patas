-- Regras de missão no servidor (MUDANCAS-V2 §1 e §7) via confirm_mission. Desfaz tudo no fim.
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-0000000000f1', 'mis@example.test');
insert into public.dogs (id, owner_id, name) values ('d0000000-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-0000000000f1', 'Luna');
insert into public.media_assets (id, owner_id, dog_id, private_storage_key, mime, bytes, width, height, hash, status)
  select ('a0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'aaaaaaaa-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-0000000000f1', 'k' || i, 'image/webp', 1, 1, 1, 'h' || i, 'ready' from generate_series(1, 12) i;
insert into public.diary_entries (id, owner_id, dog_id, media_asset_id, occurred_date, timezone, source, request_key)
  select ('e0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'aaaaaaaa-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-0000000000f1',
         ('a0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, '2026-10-12', 'America/Sao_Paulo', 'free', gen_random_uuid() from generate_series(1, 12) i;
insert into public.daily_plans (owner_id, dog_id, plan_date, slots, shown) values
  ('aaaaaaaa-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-0000000000f1', '2026-10-12', '{"A":"D01","B":"D17","C":"D25"}', '{"A":["D01"],"B":["D17"],"C":["D25"]}');

create temp table r (xp integer, already boolean, medals text[]);
create function pg_temp.c(t text, e int, approved boolean default true, day date default '2026-10-12', period text default null) returns setof r language sql as $$
  select * from public.confirm_mission('aaaaaaaa-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-0000000000f1', t,
    ('e0000000-0000-4000-8000-0000000000' || lpad(e::text, 2, '0'))::uuid, gen_random_uuid(), approved, day, period)
$$;
create function pg_temp.expect_error(q text, code text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if sqlerrm <> code then raise exception 'esperava %, veio %', code, sqlerrm; end if; return;
  end;
  raise exception 'esperava erro % em: %', code, q;
end $$;

do $$
declare x r;
begin
  perform pg_temp.expect_error($q$select pg_temp.c('M03', 1)$q$, 'LOCKED');           -- antes de M01
  select * into x from pg_temp.c('M01', 1); if x.xp <> 10 then raise exception 'M01'; end if;
  perform pg_temp.expect_error($q$select pg_temp.c('D02', 2)$q$, 'NOT_TODAY');        -- não está no plano
  select * into x from pg_temp.c('D17', 2); if x.xp <> 10 then raise exception 'D17'; end if;
  if not exists (select 1 from public.collection_advances where item_id = 'C12') then raise exception 'D17 não avançou C12'; end if;
  select * into x from pg_temp.c('D17', 3); if x.xp <> 0 or not x.already then raise exception 'D17 duas vezes no dia'; end if;
  perform pg_temp.expect_error($q$select pg_temp.c('M03', 2)$q$, 'PHOTO_ALREADY_USED'); -- foto já pontuou
  select * into x from pg_temp.c('M04', 4, false); if x.xp <> 0 then raise exception 'incerto deu XP'; end if;
  -- Completa “Brinquedos e manias” (M03, M35, C12 já avançado, C13, C14, C15).
  perform pg_temp.c('M03', 5); perform pg_temp.c('M35', 6); perform pg_temp.c('C13', 7); perform pg_temp.c('C14', 8);
  select * into x from pg_temp.c('C15', 9);
  if x.medals <> array['brinquedos-e-manias'] or x.xp <> 65 then raise exception 'medalha: % / % XP', x.medals, x.xp; end if;
  if (select count(*) from public.xp_ledger where medal_key is not null) <> 1 then raise exception 'medalha duplicada'; end if;
  -- Especial: uma vez por ocorrência.
  select * into x from pg_temp.c('S03', 10, true, '2026-10-25', '2026'); if x.xp <> 20 then raise exception 'S03'; end if;
  select * into x from pg_temp.c('S03', 11, true, '2026-10-26', '2026'); if x.xp <> 0 then raise exception 'S03 duas vezes'; end if;
  select * into x from pg_temp.c('S03', 12, true, '2027-10-25', '2027'); if x.xp <> 20 then raise exception 'S03 no ano seguinte'; end if;
  raise notice 'MISSÕES OK';
end $$;
-- Recompensa por XP: 1 crédito por marco, nunca em dobro.
do $$
declare total int; added int; u uuid := 'aaaaaaaa-0000-4000-8000-0000000000f1';
begin
  select coalesce(sum(amount), 0) into total from public.xp_ledger where dog_id = 'd0000000-0000-4000-8000-0000000000f1';
  added := public.grant_xp_credits(u, 25);
  if added <> total / 25 or added = 0 then raise exception 'XP→crédito: esperava %, veio %', total / 25, added; end if;
  if public.grant_xp_credits(u, 25) <> 0 then raise exception 'XP→crédito em dobro'; end if;
  if public.credit_available(u) <> added then raise exception 'saldo XP→crédito errado'; end if;
  raise notice 'XP→CRÉDITO OK (% XP, % créditos)', total, added;
end $$;
rollback;
