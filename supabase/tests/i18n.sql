-- Português e inglês: preferências da pessoa no perfil (valores válidos só) e especiais dos EUA
-- (uma recompensa por cachorro, missão e ano, qualquer que seja o idioma ou a região de quem envia).
begin;
do $$
declare ivan uuid := gen_random_uuid(); bia uuid := gen_random_uuid(); d uuid := gen_random_uuid(); x record; ok boolean;
begin
  insert into auth.users (id, email) values (ivan, 'ivan-l@diariodepatas.test'), (bia, 'bia-l@diariodepatas.test');
  insert into public.profiles (user_id, locale, region, weight_unit) values (ivan, 'en', 'US', 'lb'), (bia, 'pt-BR', 'BR', null);
  ok := false;
  begin update public.profiles set locale = 'fr' where user_id = ivan; exception when check_violation then ok := true; end;
  if not ok then raise exception 'idioma inválido aceito'; end if;
  ok := false;
  begin update public.profiles set weight_unit = 'st' where user_id = ivan; exception when check_violation then ok := true; end;
  if not ok then raise exception 'unidade inválida aceita'; end if;

  if (select count(*) from public.mission_templates where id in ('S04', 'S05') and kind = 'special') <> 2 then raise exception 'S04/S05 ausentes'; end if;
  if (select studio_theme from public.mission_templates where id = 'S05') <> 'thanksgiving' then raise exception 'tema S05'; end if;

  insert into public.dogs (id, owner_id, name) values (d, ivan, 'Abu');
  insert into public.dog_members (dog_id, user_id, role) values (d, bia, 'editor') on conflict do nothing;
  insert into public.media_assets (id, owner_id, dog_id, private_storage_key, mime, bytes, width, height, hash, status)
    select ('b1000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, ivan, d, 'kl' || i, 'image/webp', 1, 1, 1, 'hl' || i, 'ready' from generate_series(1, 4) i;
  insert into public.diary_entries (id, owner_id, dog_id, media_asset_id, occurred_date, timezone, source, request_key)
    select ('b2000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, ivan, d, ('b1000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
           '2026-08-25', 'America/New_York', 'free', gen_random_uuid() from generate_series(1, 4) i;
  perform public.confirm_mission(ivan, d, 'M01', 'b2000000-0000-4000-8000-000000000001'::uuid, gen_random_uuid(), true, '2026-08-25', null);
  select * into x from public.confirm_mission(ivan, d, 'S04', 'b2000000-0000-4000-8000-000000000002'::uuid, gen_random_uuid(), true, '2026-08-25', '2026');
  if x.xp_awarded <> 20 then raise exception 'S04: %', x.xp_awarded; end if;
  -- Outra pessoa da família (outro idioma/região) ou a mesma depois de trocar de idioma: sem pontos de novo.
  select * into x from public.confirm_mission(ivan, d, 'S04', 'b2000000-0000-4000-8000-000000000003'::uuid, gen_random_uuid(), true, '2026-08-26', '2026');
  if x.xp_awarded <> 0 then raise exception 'S04 repetiu pontos'; end if;
  raise notice 'IDIOMAS OK';
end $$;
rollback;
