-- Avisos: cada pessoa só lê e marca os próprios; ninguém cria aviso pelo app (só o servidor).
begin;
insert into auth.users (id, email) values
  ('71000000-0000-4000-8000-000000000001', 'ivan-n@diariodepatas.test'),
  ('72000000-0000-4000-8000-000000000002', 'bianca-n@diariodepatas.test');
insert into public.dogs (id, owner_id, name) values ('d7100000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'Abu');
insert into public.notifications (user_id, dog_id, actor_id, kind) values
  ('72000000-0000-4000-8000-000000000002', 'd7100000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'photo'),
  ('71000000-0000-4000-8000-000000000001', 'd7100000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002', 'bone');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('72000000-0000-4000-8000-000000000002', 'https://push.example/x', 'k', 'a');

set local role authenticated;
set local "request.jwt.claim.sub" = '72000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.notifications) <> 1 then raise exception 'Bianca deveria ver só o aviso dela'; end if;
  update public.notifications set read_at = now();
  if (select count(*) from public.notifications where read_at is not null) <> 1 then raise exception 'Bianca deveria marcar o aviso dela como lido'; end if;
  if (select count(*) from public.push_subscriptions) <> 1 then raise exception 'Bianca deveria ver o próprio aparelho'; end if;
  begin
    insert into public.notifications (user_id, dog_id, kind) values ('71000000-0000-4000-8000-000000000001', 'd7100000-0000-4000-8000-000000000001', 'photo');
    raise exception 'Bianca criou aviso pelo app';
  exception when insufficient_privilege then null; when others then if sqlerrm = 'Bianca criou aviso pelo app' then raise; end if;
  end;
end $$;
set local "request.jwt.claim.sub" = '71000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.notifications where read_at is null) <> 1 then raise exception 'aviso do Ivan não deveria estar lido'; end if;
  if (select count(*) from public.push_subscriptions) <> 0 then raise exception 'Ivan viu o aparelho da Bianca'; end if;
end $$;
reset role;
-- Várias fotos seguidas da mesma pessoa = um aviso com o total; depois de lido, começa outro.
do $$ declare n int; begin
  n := public.bump_photo_notice('72000000-0000-4000-8000-000000000002', 'd7100000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', gen_random_uuid());
  n := public.bump_photo_notice('72000000-0000-4000-8000-000000000002', 'd7100000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', gen_random_uuid());
  n := public.bump_photo_notice('72000000-0000-4000-8000-000000000002', 'd7100000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', gen_random_uuid());
  if n <> 3 then raise exception '3 fotos deveriam somar 3 (deu %)', n; end if;
  if (select count(*) from public.notifications where user_id = '72000000-0000-4000-8000-000000000002' and kind = 'photo' and read_at is null) <> 1 then raise exception 'deveria ser um aviso só'; end if;
  update public.notifications set read_at = now() where user_id = '72000000-0000-4000-8000-000000000002';
  n := public.bump_photo_notice('72000000-0000-4000-8000-000000000002', 'd7100000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', gen_random_uuid());
  if n <> 1 then raise exception 'depois de lido, começa um aviso novo'; end if;
end $$;
do $$ begin raise notice 'AVISOS OK'; end $$;
rollback;
