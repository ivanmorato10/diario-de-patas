-- Cartinhas e ossinhos: Ivan (admin), Bianca (editor), Duda (só ver), Carla (de fora).
begin;
insert into auth.users (id, email) values
  ('61000000-0000-4000-8000-000000000001', 'ivan-c@diariodepatas.test'),
  ('62000000-0000-4000-8000-000000000002', 'bianca-c@diariodepatas.test'),
  ('63000000-0000-4000-8000-000000000003', 'duda-c@diariodepatas.test'),
  ('64000000-0000-4000-8000-000000000004', 'carla-c@diariodepatas.test');
insert into public.dogs (id, owner_id, name) values ('d6100000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'Abu');
insert into public.dog_members (dog_id, user_id, role) values
  ('d6100000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000002', 'editor'),
  ('d6100000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000003', 'viewer');
insert into public.letters (id, dog_id, created_by, body, letter_date, request_key) values
  ('c6100000-0000-4000-8000-000000000001', 'd6100000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'Querido Abu, obrigado por tudo.', '2026-10-14', gen_random_uuid());

set local role authenticated;
-- Bianca (editor): escreve a própria, não altera a do Ivan.
set local "request.jwt.claim.sub" = '62000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"62000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$ begin
  insert into public.letters (id, dog_id, created_by, body, letter_date, request_key) values
    ('c6200000-0000-4000-8000-000000000002', 'd6100000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000002', 'Oi Abu!', '2026-10-14', gen_random_uuid());
  update public.letters set body = 'invadido' where id = 'c6100000-0000-4000-8000-000000000001';
  if (select body from public.letters where id = 'c6100000-0000-4000-8000-000000000001') = 'invadido' then raise exception 'Bianca alterou a cartinha do Ivan'; end if;
  insert into public.bones (dog_id, target_type, target_id, user_id) values ('d6100000-0000-4000-8000-000000000001', 'letter', 'c6100000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000002');
end $$;

-- Duda (só ver): lê, dá ossinho, não escreve cartinha.
set local "request.jwt.claim.sub" = '63000000-0000-4000-8000-000000000003';
set local "request.jwt.claims" = '{"sub":"63000000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.letters) <> 2 then raise exception 'Duda deveria ler as 2 cartinhas'; end if;
  insert into public.bones (dog_id, target_type, target_id, user_id) values ('d6100000-0000-4000-8000-000000000001', 'letter', 'c6100000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000003');
  begin
    insert into public.letters (dog_id, created_by, body, letter_date, request_key) values ('d6100000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000003', 'x', '2026-10-14', gen_random_uuid());
    raise exception 'Duda escreveu cartinha';
  exception when insufficient_privilege then null; when others then if sqlerrm = 'Duda escreveu cartinha' then raise; end if;
  end;
  begin
    insert into public.bones (dog_id, target_type, target_id, user_id) values ('d6100000-0000-4000-8000-000000000001', 'letter', 'c6200000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000002');
    raise exception 'Duda deu ossinho em nome da Bianca';
  exception when insufficient_privilege then null; when others then if sqlerrm = 'Duda deu ossinho em nome da Bianca' then raise; end if;
  end;
end $$;

-- Carla (de fora): não vê nada.
set local "request.jwt.claim.sub" = '64000000-0000-4000-8000-000000000004';
set local "request.jwt.claims" = '{"sub":"64000000-0000-4000-8000-000000000004","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.letters) <> 0 or (select count(*) from public.bones) <> 0 then raise exception 'Carla viu cartinhas ou ossinhos'; end if;
end $$;

-- Ivan (admin): apaga a cartinha da Bianca; ossinhos da cartinha apagada somem junto.
set local "request.jwt.claim.sub" = '61000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.bones where target_id = 'c6100000-0000-4000-8000-000000000001') <> 2 then raise exception 'cartinha do Ivan deveria ter 2 ossinhos'; end if;
  delete from public.letters where id = 'c6100000-0000-4000-8000-000000000001';
  if (select count(*) from public.bones) <> 0 then raise exception 'ossinhos ficaram órfãos'; end if;
  delete from public.letters where id = 'c6200000-0000-4000-8000-000000000002';
  if (select count(*) from public.letters) <> 0 then raise exception 'admin deveria apagar a cartinha da Bianca'; end if;
end $$;
reset role;
do $$ begin raise notice 'CARTINHAS OK'; end $$;
rollback;
