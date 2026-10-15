-- Indicações: Ivan indica 6 amigos. Só conta quem cria o próprio diário e guarda foto; uma vez por
-- pessoa; no máximo 5 recompensas no mês; as patinhas vão para o diário aberto do Ivan.
begin;
insert into auth.users (id, email) values ('51000000-0000-4000-8000-000000000001', 'ivan-ref@diariodepatas.test');
insert into public.dogs (id, owner_id, name) values ('d5100000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'Abu');
insert into public.profiles (user_id, current_dog_id) values ('51000000-0000-4000-8000-000000000001', 'd5100000-0000-4000-8000-000000000001')
  on conflict (user_id) do update set current_dog_id = excluded.current_dog_id;

do $$
declare i int; u uuid; d uuid; m uuid; got uuid;
begin
  for i in 1..6 loop
    u := ('52000000-0000-4000-8000-00000000000' || i)::uuid;
    d := ('d5200000-0000-4000-8000-00000000000' || i)::uuid;
    m := ('a5200000-0000-4000-8000-00000000000' || i)::uuid;
    insert into auth.users (id, email) values (u, 'amigo' || i || '@diariodepatas.test');
    insert into public.referrals (referrer_id, referred_id) values ('51000000-0000-4000-8000-000000000001', u);
    insert into public.dogs (id, owner_id, name) values (d, u, 'Dog' || i);
    -- Sem foto ainda: não confirma.
    if i = 1 and public.confirm_referral(u) is not null then raise exception 'confirmou sem foto'; end if;
    insert into public.media_assets (id, owner_id, dog_id, private_storage_key, mime, bytes, width, height, hash, status)
      values (m, u, d, 'r/' || i || '.webp', 'image/webp', 100, 10, 10, 'h' || i, 'ready');
    insert into public.diary_entries (owner_id, dog_id, media_asset_id, occurred_date, timezone, source, request_key)
      values (u, d, m, '2026-10-01', 'America/Sao_Paulo', 'free', gen_random_uuid());
    got := public.confirm_referral(u);
    if i <= 5 and got is distinct from 'd5100000-0000-4000-8000-000000000001'::uuid then raise exception 'amigo % deveria dar patinhas ao Abu', i; end if;
    if i = 6 and got is not null then raise exception 'passou do limite do mês'; end if;
    if public.confirm_referral(u) is not null then raise exception 'confirmou duas vezes'; end if;
  end loop;
  if (select coalesce(sum(amount), 0) from public.xp_ledger where dog_id = 'd5100000-0000-4000-8000-000000000001') <> 100 then raise exception 'Abu deveria ter 100 patinhas de indicação'; end if;
  if (select count(*) from public.referrals where confirmed_at is not null) <> 6 then raise exception 'as 6 indicações ficam confirmadas'; end if;
  begin
    insert into public.referrals (referrer_id, referred_id) values ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001');
    raise exception 'indicou a si mesmo';
  exception when check_violation then null;
  end;
end $$;

-- Amigo não vê as indicações do Ivan; Ivan vê as dele.
set local role authenticated;
set local "request.jwt.claim.sub" = '52000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"52000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.referrals) <> 0 then raise exception 'amigo viu indicações do Ivan'; end if;
end $$;
set local "request.jwt.claim.sub" = '51000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.referrals) <> 6 then raise exception 'Ivan deveria ver as 6 indicações'; end if;
  begin
    perform public.confirm_referral('52000000-0000-4000-8000-000000000001');
    raise exception 'cliente chamou confirm_referral';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin raise notice 'INDICAÇÕES OK'; end $$;
rollback;
