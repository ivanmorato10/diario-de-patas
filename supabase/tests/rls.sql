-- Teste automatizado de isolamento entre contas (MUDANCAS-V2 §8.3).
-- B não consegue ler nem alterar nada de A por URL/ID: registros, mídia, documentos, links, jobs,
-- créditos, dados de saúde, missões e medalhas. Visitante anônimo não vê nada.
-- Falha = exceção (o psql sai com erro). Sucesso = NOTICE "RLS OK".
-- Roda depois das migrations e do seed. Usa uma transação e desfaz tudo no fim.

begin;

-- ---------- Dados da conta A (como superusuário/servidor) ----------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'rls-a@example.test'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'rls-b@example.test');
insert into public.profiles (user_id) values ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002');
insert into public.dogs (id, owner_id, name) values
  ('d0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001', 'Luna'),
  ('d0000000-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-000000000002', 'Thor');
insert into public.media_assets (id, owner_id, dog_id, private_storage_key, mime, bytes, width, height, hash, status) values
  ('a0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a', 'a/m1.webp', 'image/webp', 100, 10, 10, 'h', 'ready');
insert into public.diary_entries (id, owner_id, dog_id, media_asset_id, occurred_date, timezone, source, request_key) values
  ('e0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1', '2026-10-01', 'America/Sao_Paulo', 'free', gen_random_uuid());
insert into public.albums (id, owner_id, dog_id, collection_id, title) values
  ('a1b00000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a', 'vida-em-casa', 'Vida em casa');
insert into public.album_entries (album_id, entry_id) values ('a1b00000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-0000000000a1');
insert into public.share_links (id, owner_id, token_hash, title) values ('5a000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'hash-a', 'Para a família');
insert into public.share_link_entries (share_link_id, entry_id) values ('5a000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-0000000000a1');
insert into public.generation_jobs (owner_id, theme_id, idempotency_key) values ('aaaaaaaa-0000-4000-8000-000000000001', 'natal', gen_random_uuid());
insert into public.credit_ledger (owner_id, operation, amount, idempotency_key) values ('aaaaaaaa-0000-4000-8000-000000000001', 'grant', 5, 'grant:a');
insert into public.health_profiles (dog_id, owner_id, breed) values ('d0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001', 'SRD');
insert into public.weights (owner_id, dog_id, date, kg) values ('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a', '2026-10-01', 8.4);
insert into public.vaccines (owner_id, dog_id, kind, name, applied_date) values ('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a', 'vaccine', 'V10', '2026-10-01');
insert into public.visits (id, owner_id, dog_id, date) values ('c0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a', '2026-10-01');
insert into public.medications (owner_id, dog_id, name, start_date) values ('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a', 'X', '2026-10-01');
insert into public.contacts (owner_id, dog_id, kind, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a', 'vet', 'Dra. Ana');
insert into public.documents (id, owner_id, dog_id, title, category, private_storage_key, mime, bytes, status) values
  ('d0c00000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a', 'RG', 'id_chip', 'a/d1.pdf', 'application/pdf', 10, 'ready');
insert into public.visit_documents (visit_id, document_id) values ('c0000000-0000-4000-8000-0000000000a1', 'd0c00000-0000-4000-8000-0000000000a1');
insert into public.daily_plans (owner_id, dog_id, plan_date, slots, shown) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a', '2026-10-12', '{"A":"D01","B":"D13","C":"D25"}', '{"A":["D01"],"B":["D13"],"C":["D25"]}');
insert into public.medals (dog_id, owner_id, set_id) values ('d0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001', 'nos-dois');
insert into public.collection_advances (dog_id, owner_id, item_id, via_mission_id) values ('d0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001', 'C12', 'D17');
-- Missão concluída por A via função do servidor (também testa confirm_mission).
do $$ begin
  if (select xp_awarded from public.confirm_mission('aaaaaaaa-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000a', 'M01', 'e0000000-0000-4000-8000-0000000000a1', gen_random_uuid(), true, '2026-10-12', null)) <> 10 then raise exception 'FALHOU: confirm_mission'; end if;
end $$;

-- ---------- Como B: não vê nada de A ----------
set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';

do $$
declare t text; n bigint;
  tables text[] := array['profiles', 'dogs', 'media_assets', 'diary_entries', 'albums', 'album_entries', 'share_links', 'share_link_entries',
    'generation_jobs', 'credit_ledger', 'usage_events', 'mission_instances', 'mission_submissions', 'mission_completions', 'xp_ledger',
    'health_profiles', 'weights', 'vaccines', 'visits', 'medications', 'contacts', 'documents', 'visit_documents',
    'daily_plans', 'collection_advances', 'medals', 'storage_cleanup'];
begin
  foreach t in array tables loop
    execute format('select count(*) from public.%I where %s', t,
      case when t in ('profiles') then 'user_id <> auth.uid()'
           when t in ('album_entries') then 'album_id = ''a1b00000-0000-4000-8000-0000000000a1'''
           when t in ('share_link_entries') then 'share_link_id = ''5a000000-0000-4000-8000-0000000000a1'''
           when t in ('visit_documents') then 'visit_id = ''c0000000-0000-4000-8000-0000000000a1'''
           when t in ('mission_instances', 'xp_ledger', 'health_profiles', 'medals', 'collection_advances') then 'dog_id = ''d0000000-0000-4000-8000-00000000000a'''
           when t in ('mission_completions', 'storage_cleanup') then 'true'
           else 'owner_id = ''aaaaaaaa-0000-4000-8000-000000000001''' end) into n;
    if n <> 0 then raise exception 'RLS FALHOU: B vê % linha(s) de A em %', n, t; end if;
  end loop;
  -- Por ID direto (como se viesse de uma URL).
  if exists (select 1 from public.diary_entries where id = 'e0000000-0000-4000-8000-0000000000a1') then raise exception 'RLS FALHOU: lembrança de A por ID'; end if;
  if exists (select 1 from public.media_assets where id = 'a0000000-0000-4000-8000-0000000000a1') then raise exception 'RLS FALHOU: mídia de A por ID'; end if;
  if exists (select 1 from public.documents where id = 'd0c00000-0000-4000-8000-0000000000a1') then raise exception 'RLS FALHOU: documento de A por ID'; end if;
end $$;

-- B não altera nem apaga nada de A (0 linhas afetadas, sem erro).
do $$
declare n int;
begin
  update public.dogs set name = 'Invadido' where id = 'd0000000-0000-4000-8000-00000000000a'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FALHOU: B alterou o cachorro de A'; end if;
  delete from public.vaccines where owner_id = 'aaaaaaaa-0000-4000-8000-000000000001'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FALHOU: B apagou vacinas de A'; end if;
  update public.documents set title = 'x' where id = 'd0c00000-0000-4000-8000-0000000000a1'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FALHOU: B alterou documento de A'; end if;
end $$;

-- B não grava em nome de A nem aponta para coisas de A.
do $$
declare
  attempts text[] := array[
    $q$insert into public.dogs (owner_id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'x')$q$,
    $q$insert into public.vaccines (owner_id, dog_id, kind, name, applied_date) values ('bbbbbbbb-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000a', 'vaccine', 'x', '2026-10-01')$q$,
    $q$insert into public.albums (owner_id, dog_id, title) values ('bbbbbbbb-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000a', 'x')$q$,
    $q$insert into public.album_entries (album_id, entry_id) values ('a1b00000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-0000000000a1')$q$,
    $q$insert into public.diary_entries (owner_id, dog_id, media_asset_id, occurred_date, timezone, request_key) values ('bbbbbbbb-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-0000000000a1', '2026-10-01', 'UTC', gen_random_uuid())$q$,
    $q$insert into public.xp_ledger (dog_id, medal_key, amount, reason) values ('d0000000-0000-4000-8000-00000000000b', 'fake', 999, 'x')$q$,
    $q$insert into public.credit_ledger (owner_id, operation, amount, idempotency_key) values ('bbbbbbbb-0000-4000-8000-000000000002', 'grant', 999, 'fake')$q$,
    $q$insert into public.medals (dog_id, owner_id, set_id) values ('d0000000-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-000000000002', 'nos-dois')$q$,
    $q$update public.dogs set photo_asset_id = 'a0000000-0000-4000-8000-0000000000a1' where id = 'd0000000-0000-4000-8000-00000000000b'$q$,
    $q$select public.confirm_mission('bbbbbbbb-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-00000000000b', 'M01', 'e0000000-0000-4000-8000-0000000000a1', gen_random_uuid(), true, '2026-10-12', null)$q$,
    $q$select public.award_medal('d0000000-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-000000000002', 'nos-dois')$q$,
    $q$select * from public.resolve_share('hash-a')$q$,
    $q$select public.prepare_account_deletion('aaaaaaaa-0000-4000-8000-000000000001')$q$,
    $q$select public.reserve_credit('bbbbbbbb-0000-4000-8000-000000000002', gen_random_uuid(), 1)$q$
  ];
  q text; ok boolean;
begin
  foreach q in array attempts loop
    ok := false;
    begin
      execute q;
    exception when others then ok := true; -- recusado (RLS, permissão ou regra)
    end;
    if not ok then raise exception 'RLS FALHOU: B conseguiu executar: %', q; end if;
  end loop;
end $$;

-- ---------- Visitante anônimo: nada ----------
reset role;
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{"role":"anon"}';
do $$
declare n bigint;
begin
  select (select count(*) from public.dogs) + (select count(*) from public.diary_entries) + (select count(*) from public.documents)
       + (select count(*) from public.vaccines) + (select count(*) from public.share_links) into n;
  if n <> 0 then raise exception 'RLS FALHOU: anônimo vê % linha(s)', n; end if;
end $$;

-- ---------- A vê o que é seu (o teste não passa “de graça”) ----------
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.diary_entries) <> 1 or (select count(*) from public.documents) <> 1 or (select count(*) from public.vaccines) <> 1
     or (select count(*) from public.xp_ledger) <> 1 or (select count(*) from public.medals) <> 1 then
    raise exception 'RLS FALHOU: A não vê os próprios dados';
  end if;
end $$;

-- Link compartilhado: o servidor resolve só a seleção; revogado → nada.
reset role;
do $$
begin
  if (select count(*) from public.resolve_share('hash-a')) <> 1 then raise exception 'FALHOU: link ativo não resolve a seleção'; end if;
  update public.share_links set revoked_at = now() where token_hash = 'hash-a';
  if (select count(*) from public.resolve_share('hash-a')) <> 0 then raise exception 'FALHOU: link revogado ainda funciona'; end if;
  if (select count(*) from public.prepare_account_deletion('aaaaaaaa-0000-4000-8000-000000000001')) is null then raise exception 'FALHOU: exclusão'; end if;
  if exists (select 1 from public.generation_jobs where owner_id = 'aaaaaaaa-0000-4000-8000-000000000001' and state <> 'cancelled') then raise exception 'FALHOU: jobs não cancelados'; end if;
  if (select count(*) from public.storage_cleanup where reason = 'account_deleted') < 2 then raise exception 'FALHOU: arquivos não enfileirados para apagar'; end if;
  raise notice 'RLS OK';
end $$;

rollback;
