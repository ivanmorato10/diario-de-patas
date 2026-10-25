-- Estúdio: limites do dia conferidos na criação (com trava). A concorrência real é garantida pelas travas
-- (pg_advisory_xact_lock 'entries:<cão>' e 'studio-daily'); aqui conferimos a regra em sequência.
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-0000000000e1', 'limits@example.test');
do $$
declare
  o uuid := 'aaaaaaaa-0000-4000-8000-0000000000e1'; d uuid := gen_random_uuid(); e uuid := gen_random_uuid(); m uuid := gen_random_uuid();
  k1 uuid := gen_random_uuid(); j1 uuid; j1b uuid; ok boolean;
  job jsonb;
begin
  insert into public.dogs (id, owner_id, name) values (d, o, 'Abu');
  insert into public.media_assets (id, owner_id, dog_id, private_storage_key, mime, bytes, width, height, hash, status) values (m, o, d, 'k', 'image/webp', 1, 1, 1, 'h', 'ready');
  insert into public.diary_entries (id, owner_id, dog_id, media_asset_id, occurred_date, timezone, request_key) values (e, o, d, m, '2026-10-20', 'UTC', gen_random_uuid());
  job := jsonb_build_object('owner_id', o, 'dog_id', d, 'requested_by', o, 'input_entry_id', e, 'input_asset_id', m, 'theme_id', 'natal', 'preset_version', 1, 'aspect', '1:1', 'credits', 1, 'cost_usd', 0.04);
  -- limite de 1 por cachorro no dia
  j1 := public.create_studio_job(job || jsonb_build_object('idempotency_key', k1), 100, null, 1, 100);
  j1b := public.create_studio_job(job || jsonb_build_object('idempotency_key', k1), 100, null, 1, 100);
  if j1b <> j1 then raise exception 'FALHOU: repetição criou outro job'; end if;
  ok := false;
  begin
    perform public.create_studio_job(job || jsonb_build_object('idempotency_key', gen_random_uuid()), 100, null, 1, 100);
  exception when others then ok := sqlerrm like '%DAILY_LIMIT%';
  end;
  if not ok then raise exception 'FALHOU: passou do limite por cachorro'; end if;
  -- limite geral
  ok := false;
  begin
    perform public.create_studio_job(job || jsonb_build_object('idempotency_key', gen_random_uuid()), 100, null, 100, 1);
  exception when others then ok := sqlerrm like '%GLOBAL_LIMIT%';
  end;
  if not ok then raise exception 'FALHOU: passou do limite geral'; end if;
  -- pedido recusado por falta de crédito não conta no limite
  update public.generation_jobs set state = 'failed', failure_code = 'NO_CREDITS' where id = j1;
  perform public.create_studio_job(job || jsonb_build_object('idempotency_key', gen_random_uuid()), 100, null, 1, 100);
  raise notice 'LIMITES DO ESTÚDIO OK';
end $$;
rollback;
