-- Revisão de segurança S02: pela Data API (sessão de B), nada de trocar dono, chaves de Storage, mídia/documento
-- de outro diário ou ligações entre diários. B é editor do diário de A (família) e dono do próprio.
-- As edições normais do app (nome, legenda, título, cuidados) continuam funcionando.
-- Falha = exceção. Sucesso = NOTICE "SECURITY BOUNDARIES OK". Desfaz tudo no fim.

begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-0000000000a5', 'sb-a@example.test'),
  ('bbbbbbbb-0000-4000-8000-0000000000b5', 'sb-b@example.test');
insert into public.profiles (user_id) values ('aaaaaaaa-0000-4000-8000-0000000000a5'), ('bbbbbbbb-0000-4000-8000-0000000000b5');
insert into public.dogs (id, owner_id, name) values
  ('d0000000-0000-4000-8000-0000000000a5', 'aaaaaaaa-0000-4000-8000-0000000000a5', 'Luna'),
  ('d0000000-0000-4000-8000-0000000000b5', 'bbbbbbbb-0000-4000-8000-0000000000b5', 'Thor');
insert into public.dog_members (dog_id, user_id, role) values ('d0000000-0000-4000-8000-0000000000a5', 'bbbbbbbb-0000-4000-8000-0000000000b5', 'editor');
insert into public.media_assets (id, owner_id, dog_id, private_storage_key, mime, bytes, width, height, hash, status) values
  ('a0000000-0000-4000-8000-0000000000a5', 'aaaaaaaa-0000-4000-8000-0000000000a5', 'd0000000-0000-4000-8000-0000000000a5', 'a/m.webp', 'image/webp', 1, 1, 1, 'h', 'ready'),
  ('a0000000-0000-4000-8000-0000000000b5', 'bbbbbbbb-0000-4000-8000-0000000000b5', 'd0000000-0000-4000-8000-0000000000b5', 'b/m.webp', 'image/webp', 1, 1, 1, 'h', 'ready');
insert into public.diary_entries (id, owner_id, dog_id, media_asset_id, occurred_date, timezone, source, request_key) values
  ('e0000000-0000-4000-8000-0000000000a5', 'aaaaaaaa-0000-4000-8000-0000000000a5', 'd0000000-0000-4000-8000-0000000000a5', 'a0000000-0000-4000-8000-0000000000a5', '2026-10-01', 'UTC', 'free', gen_random_uuid()),
  ('e0000000-0000-4000-8000-0000000000b5', 'bbbbbbbb-0000-4000-8000-0000000000b5', 'd0000000-0000-4000-8000-0000000000b5', 'a0000000-0000-4000-8000-0000000000b5', '2026-10-01', 'UTC', 'free', gen_random_uuid());
insert into public.albums (id, owner_id, dog_id, title, type) values
  ('a1b00000-0000-4000-8000-0000000000b5', 'bbbbbbbb-0000-4000-8000-0000000000b5', 'd0000000-0000-4000-8000-0000000000b5', 'Meu', 'custom');
insert into public.documents (id, owner_id, dog_id, title, category, private_storage_key, thumb_storage_key, mime, bytes, status) values
  ('d0c00000-0000-4000-8000-0000000000a5', 'aaaaaaaa-0000-4000-8000-0000000000a5', 'd0000000-0000-4000-8000-0000000000a5', 'RG', 'id_chip', 'a/d.pdf', 'a/d.webp', 'application/pdf', 1, 'ready'),
  ('d0c00000-0000-4000-8000-0000000000b5', 'bbbbbbbb-0000-4000-8000-0000000000b5', 'd0000000-0000-4000-8000-0000000000b5', 'RG', 'id_chip', 'b/d.pdf', 'b/d.webp', 'application/pdf', 1, 'ready');
insert into public.visits (id, owner_id, dog_id, date) values ('c0000000-0000-4000-8000-0000000000b5', 'bbbbbbbb-0000-4000-8000-0000000000b5', 'd0000000-0000-4000-8000-0000000000b5', '2026-10-01');

-- Executa o comando e exige que seja RECUSADO (sem permissão ou referência fora do diário).
create function pg_temp.must_fail(label text, cmd text) returns void language plpgsql as $$
begin
  begin
    execute cmd;
  exception when insufficient_privilege or raise_exception or check_violation or foreign_key_violation then return;
  end;
  raise exception 'FALHOU: % foi aceito', label;
end $$;

set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-0000-4000-8000-0000000000b5';
set local "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-4000-8000-0000000000b5","role":"authenticated"}';

-- ---------- Recusado ----------
select pg_temp.must_fail('trocar a chave do documento pela de A', $q$update public.documents set thumb_storage_key = 'a/d.pdf' where id = 'd0c00000-0000-4000-8000-0000000000b5'$q$);
select pg_temp.must_fail('trocar status/mime do documento', $q$update public.documents set mime = 'text/html' where id = 'd0c00000-0000-4000-8000-0000000000b5'$q$);
select pg_temp.must_fail('editor vira dono do diário de A', $q$update public.dogs set owner_id = 'bbbbbbbb-0000-4000-8000-0000000000b5' where id = 'd0000000-0000-4000-8000-0000000000a5'$q$);
select pg_temp.must_fail('foto do perfil com mídia de outro diário', $q$update public.dogs set photo_asset_id = 'a0000000-0000-4000-8000-0000000000a5' where id = 'd0000000-0000-4000-8000-0000000000b5'$q$);
select pg_temp.must_fail('lembrança apontando para mídia de A', $q$update public.diary_entries set media_asset_id = 'a0000000-0000-4000-8000-0000000000a5' where id = 'e0000000-0000-4000-8000-0000000000b5'$q$);
select pg_temp.must_fail('mover lembrança para outro diário', $q$update public.diary_entries set dog_id = 'd0000000-0000-4000-8000-0000000000a5' where id = 'e0000000-0000-4000-8000-0000000000b5'$q$);
select pg_temp.must_fail('desapagar/trocar origem da lembrança', $q$update public.diary_entries set source = 'studio' where id = 'e0000000-0000-4000-8000-0000000000b5'$q$);
select pg_temp.must_fail('capa de álbum com mídia de A', $q$update public.albums set cover_asset_id = 'a0000000-0000-4000-8000-0000000000a5' where id = 'a1b00000-0000-4000-8000-0000000000b5'$q$);
select pg_temp.must_fail('criar álbum de sistema direto', $q$insert into public.albums (owner_id, dog_id, title, type, system_key) values ('bbbbbbbb-0000-4000-8000-0000000000b5', 'd0000000-0000-4000-8000-0000000000b5', 'x', 'custom', 'studio')$q$);
select pg_temp.must_fail('lembrança de A no álbum de B', $q$insert into public.album_entries (album_id, entry_id) values ('a1b00000-0000-4000-8000-0000000000b5', 'e0000000-0000-4000-8000-0000000000a5')$q$);
select pg_temp.must_fail('documento de A na consulta de B', $q$insert into public.visit_documents (visit_id, document_id) values ('c0000000-0000-4000-8000-0000000000b5', 'd0c00000-0000-4000-8000-0000000000a5')$q$);
select pg_temp.must_fail('vacina com documento de A', $q$insert into public.vaccines (owner_id, dog_id, kind, name, applied_date, document_id) values ('bbbbbbbb-0000-4000-8000-0000000000b5', 'd0000000-0000-4000-8000-0000000000b5', 'vaccine', 'V', '2026-10-01', 'd0c00000-0000-4000-8000-0000000000a5')$q$);
select pg_temp.must_fail('peso com dono falso', $q$insert into public.weights (owner_id, dog_id, date, kg) values ('aaaaaaaa-0000-4000-8000-0000000000a5', 'd0000000-0000-4000-8000-0000000000b5', '2026-10-01', 5)$q$);
select pg_temp.must_fail('mover peso de diário', $q$update public.weights set dog_id = 'd0000000-0000-4000-8000-0000000000a5' where dog_id = 'd0000000-0000-4000-8000-0000000000b5'$q$);
select pg_temp.must_fail('saúde com dono falso', $q$insert into public.health_profiles (dog_id, owner_id, breed) values ('d0000000-0000-4000-8000-0000000000b5', 'aaaaaaaa-0000-4000-8000-0000000000a5', 'x')$q$);
select pg_temp.must_fail('perfil: créditos de boas-vindas', $q$update public.profiles set welcome_credits_at = null where user_id = 'bbbbbbbb-0000-4000-8000-0000000000b5'$q$);
select pg_temp.must_fail('perfil: código de indicação', $q$update public.profiles set referral_code = 'VIP' where user_id = 'bbbbbbbb-0000-4000-8000-0000000000b5'$q$);
select pg_temp.must_fail('perfil: apagar', $q$delete from public.profiles where user_id = 'bbbbbbbb-0000-4000-8000-0000000000b5'$q$);
select pg_temp.must_fail('cartinha direto', $q$insert into public.letters (dog_id, created_by, body, letter_date, request_key) values ('d0000000-0000-4000-8000-0000000000b5', 'bbbbbbbb-0000-4000-8000-0000000000b5', 'x', '2026-10-01', gen_random_uuid())$q$);
select pg_temp.must_fail('ossinho direto em lembrança de A', $q$insert into public.bones (dog_id, target_type, target_id, user_id) values ('d0000000-0000-4000-8000-0000000000b5', 'entry', 'e0000000-0000-4000-8000-0000000000a5', 'bbbbbbbb-0000-4000-8000-0000000000b5')$q$);
select pg_temp.must_fail('crédito direto', $q$insert into public.credit_ledger (owner_id, dog_id, operation, amount, idempotency_key) values ('bbbbbbbb-0000-4000-8000-0000000000b5', 'd0000000-0000-4000-8000-0000000000b5', 'grant', 99, 'x')$q$);
select pg_temp.must_fail('XP direto', $q$insert into public.xp_ledger (dog_id, completion_id, amount, reason) values ('d0000000-0000-4000-8000-0000000000b5', gen_random_uuid(), 999, 'x')$q$);

-- ---------- Continua funcionando (o que o app grava com a sessão) ----------
do $$
declare n int;
begin
  update public.dogs set name = 'Thor II', nickname = 'T', avatar_crop = '{"x":50,"y":50,"zoom":1}', photo_asset_id = 'a0000000-0000-4000-8000-0000000000b5' where id = 'd0000000-0000-4000-8000-0000000000b5';
  get diagnostics n = row_count; if n <> 1 then raise exception 'FALHOU: editar o próprio cachorro'; end if;
  update public.dogs set name = 'Luna!' where id = 'd0000000-0000-4000-8000-0000000000a5';
  get diagnostics n = row_count; if n <> 1 then raise exception 'FALHOU: editor edita o nome do diário da família'; end if;
  update public.diary_entries set caption = 'oi', occurred_date = '2026-10-02' where id = 'e0000000-0000-4000-8000-0000000000b5';
  get diagnostics n = row_count; if n <> 1 then raise exception 'FALHOU: legenda'; end if;
  update public.documents set title = 'Novo', notes = 'n', updated_at = now() where id = 'd0c00000-0000-4000-8000-0000000000b5';
  get diagnostics n = row_count; if n <> 1 then raise exception 'FALHOU: título do documento'; end if;
  update public.albums set title = 'Outro' where id = 'a1b00000-0000-4000-8000-0000000000b5';
  insert into public.album_entries (album_id, entry_id) values ('a1b00000-0000-4000-8000-0000000000b5', 'e0000000-0000-4000-8000-0000000000b5');
  insert into public.visit_documents (visit_id, document_id) values ('c0000000-0000-4000-8000-0000000000b5', 'd0c00000-0000-4000-8000-0000000000b5');
  insert into public.vaccines (owner_id, dog_id, kind, name, applied_date, document_id) values ('bbbbbbbb-0000-4000-8000-0000000000b5', 'd0000000-0000-4000-8000-0000000000b5', 'vaccine', 'V10', '2026-10-01', 'd0c00000-0000-4000-8000-0000000000b5');
  update public.vaccines set name = 'V8', updated_at = now() where dog_id = 'd0000000-0000-4000-8000-0000000000b5';
  insert into public.weights (owner_id, dog_id, date, kg) values ('bbbbbbbb-0000-4000-8000-0000000000b5', 'd0000000-0000-4000-8000-0000000000b5', '2026-10-01', 8);
  -- Família: B grava peso no diário de A com A como dono (como o servidor faz: owner_id = dono do diário).
  insert into public.weights (owner_id, dog_id, date, kg) values ('aaaaaaaa-0000-4000-8000-0000000000a5', 'd0000000-0000-4000-8000-0000000000a5', '2026-10-01', 9);
  insert into public.health_profiles (dog_id, owner_id, breed) values ('d0000000-0000-4000-8000-0000000000b5', 'bbbbbbbb-0000-4000-8000-0000000000b5', 'SRD')
    on conflict (dog_id) do update set dog_id = excluded.dog_id, owner_id = excluded.owner_id, breed = excluded.breed;
  insert into public.health_profiles (dog_id, owner_id, breed) values ('d0000000-0000-4000-8000-0000000000b5', 'bbbbbbbb-0000-4000-8000-0000000000b5', 'Vira-lata')
    on conflict (dog_id) do update set dog_id = excluded.dog_id, owner_id = excluded.owner_id, breed = excluded.breed;
  update public.profiles set display_name = 'Bia', timezone = 'UTC', demo_imported_at = now() where user_id = 'bbbbbbbb-0000-4000-8000-0000000000b5';
  get diagnostics n = row_count; if n <> 1 then raise exception 'FALHOU: nome no perfil'; end if;
  insert into public.dogs (owner_id, name, nickname, birth_date, preferences_json) values ('bbbbbbbb-0000-4000-8000-0000000000b5', 'Novo', null, null, '{}');
end $$;

-- Visitante anônimo: nenhuma escrita.
reset role;
set local role anon;
set local "request.jwt.claim.sub" = '';
select pg_temp.must_fail('anônimo cria cachorro', $q$insert into public.dogs (owner_id, name) values ('aaaaaaaa-0000-4000-8000-0000000000a5', 'x')$q$);

-- O servidor (service role / dono das funções) continua livre para gravar as colunas protegidas.
reset role;
update public.documents set thumb_storage_key = 'b/d2.webp' where id = 'd0c00000-0000-4000-8000-0000000000b5';

do $$ begin raise notice 'SECURITY BOUNDARIES OK'; end $$;
rollback;
