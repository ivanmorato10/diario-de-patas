-- Revisão 25/10/2026: tentativas de compra da Apple, denúncias, bloqueios, token do login Apple e autorização de IA.
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-0000000000f1', 'a@example.test'), ('aaaaaaaa-0000-4000-8000-0000000000f2', 'b@example.test');
do $$
declare a uuid := 'aaaaaaaa-0000-4000-8000-0000000000f1'; b uuid := 'aaaaaaaa-0000-4000-8000-0000000000f2'; d uuid := gen_random_uuid(); t uuid := gen_random_uuid(); ok boolean;
begin
  insert into public.dogs (id, owner_id, name) values (d, a, 'Abu');
  -- Tentativa de compra: diário apagado vira nulo (pendência explícita), nunca outro diário.
  insert into public.apple_purchase_attempts (id, user_id, dog_id) values (t, a, d);
  delete from public.dogs where id = d;
  if (select dog_id from public.apple_purchase_attempts where id = t) is not null then raise exception 'FALHOU: destino não ficou nulo'; end if;
  -- Bloqueio: não bloqueia a si mesmo; repetição não duplica.
  insert into public.user_blocks (blocker_id, blocked_id) values (a, b);
  insert into public.user_blocks (blocker_id, blocked_id) values (a, b) on conflict do nothing;
  if (select count(*) from public.user_blocks where blocker_id = a) <> 1 then raise exception 'FALHOU: bloqueio duplicado'; end if;
  ok := false;
  begin insert into public.user_blocks (blocker_id, blocked_id) values (a, a); exception when check_violation then ok := true; end;
  if not ok then raise exception 'FALHOU: bloqueou a si mesmo'; end if;
  -- Denúncia: motivo fora da lista é recusado; quem denunciou some (conta excluída) e a denúncia fica.
  ok := false;
  begin insert into public.content_reports (target_type, target_id, reason) values ('entry', 'x', 'qualquer'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'FALHOU: motivo inválido aceito'; end if;
  insert into public.content_reports (reporter_id, target_type, target_id, reason) values (b, 'user', a::text, 'harassment');
  insert into public.apple_signin_tokens (user_id, refresh_token_sealed) values (b, 'v1.x.y.z');
  update public.profiles set ai_consent_version = 1, ai_consent_at = now() where user_id = b;
  delete from auth.users where id = b;
  if (select reporter_id from public.content_reports where target_id = a::text) is not null then raise exception 'FALHOU: denúncia não sobreviveu'; end if;
  if exists (select 1 from public.apple_signin_tokens where user_id = b) then raise exception 'FALHOU: token da Apple ficou'; end if;
  if exists (select 1 from public.user_blocks where blocked_id = b) then raise exception 'FALHOU: bloqueio ficou'; end if;
  -- RLS ligada e sem política: ninguém além do servidor lê.
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename in ('apple_purchase_attempts', 'content_reports', 'user_blocks', 'apple_signin_tokens') and not rowsecurity) then raise exception 'FALHOU: RLS desligada'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('apple_purchase_attempts', 'content_reports', 'user_blocks', 'apple_signin_tokens')) then raise exception 'FALHOU: política inesperada'; end if;
  raise notice 'SEGURANÇA E APPLE OK';
end $$;
rollback;
