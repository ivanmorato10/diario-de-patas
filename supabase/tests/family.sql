-- Família: Ivan (admin) convida Bianca (editor) e Duda (só ver). Carla é de fora.
-- Bianca lê e escreve no diário do Abu; Duda só lê; Carla não vê nada. Créditos são por diário.
begin;
insert into auth.users (id, email) values
  ('11111111-0000-4000-8000-000000000001', 'ivan@diariodepatas.test'),
  ('22222222-0000-4000-8000-000000000002', 'bianca@diariodepatas.test'),
  ('33333333-0000-4000-8000-000000000003', 'duda@diariodepatas.test'),
  ('44444444-0000-4000-8000-000000000004', 'carla@diariodepatas.test');
insert into public.dogs (id, owner_id, name) values
  ('dddddddd-0000-4000-8000-0000000000ab', '11111111-0000-4000-8000-000000000001', 'Abu'),
  ('dddddddd-0000-4000-8000-0000000000ec', '11111111-0000-4000-8000-000000000001', 'Pepe');
insert into public.dog_members (dog_id, user_id, role) values
  ('dddddddd-0000-4000-8000-0000000000ab', '22222222-0000-4000-8000-000000000002', 'editor'),
  ('dddddddd-0000-4000-8000-0000000000ab', '33333333-0000-4000-8000-000000000003', 'viewer');
insert into public.weights (owner_id, dog_id, date, kg) values ('11111111-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-0000000000ab', '2026-10-01', 7.4);
insert into public.weights (owner_id, dog_id, date, kg) values ('11111111-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-0000000000ec', '2026-10-01', 12.0);
select public.grant_welcome_credits('11111111-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-0000000000ab', 3);
select public.grant_welcome_credits('11111111-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-0000000000ec', 3); -- uma vez por pessoa: não repete

do $$ begin
  if (select count(*) from public.dog_members where user_id = '11111111-0000-4000-8000-000000000001' and role = 'admin') <> 2 then raise exception 'criador deveria ser admin dos dois diários'; end if;
  if public.credit_available_dog('dddddddd-0000-4000-8000-0000000000ab') <> 3 then raise exception 'boas-vindas no 1º diário'; end if;
  if public.credit_available_dog('dddddddd-0000-4000-8000-0000000000ec') <> 0 then raise exception 'boas-vindas só uma vez por pessoa'; end if;
end $$;

-- Bianca (editor): vê e escreve no Abu; não vê o Pepe.
set local role authenticated;
set local "request.jwt.claim.sub" = '22222222-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"sub":"22222222-0000-4000-8000-000000000002","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.dogs) <> 1 then raise exception 'Bianca deveria ver só o Abu'; end if;
  if (select count(*) from public.weights) <> 1 then raise exception 'Bianca deveria ver o peso do Abu (e não o do Pepe)'; end if;
  insert into public.weights (owner_id, dog_id, date, kg) values ('11111111-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-0000000000ab', '2026-10-10', 7.5);
  if (select count(*) from public.weights) <> 2 then raise exception 'editor deveria conseguir anotar'; end if;
  begin
    insert into public.weights (owner_id, dog_id, date, kg) values ('11111111-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-0000000000ec', '2026-10-10', 1);
    raise exception 'Bianca escreveu no Pepe';
  exception when insufficient_privilege or check_violation then null; when others then if sqlerrm = 'Bianca escreveu no Pepe' then raise; end if;
  end;
end $$;

-- Duda (só ver): lê, mas não escreve.
set local "request.jwt.claim.sub" = '33333333-0000-4000-8000-000000000003';
set local "request.jwt.claims" = '{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.weights) <> 2 then raise exception 'Duda deveria ler os pesos do Abu'; end if;
  begin
    insert into public.weights (owner_id, dog_id, date, kg) values ('11111111-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-0000000000ab', '2026-10-11', 1);
    raise exception 'Duda escreveu';
  exception when insufficient_privilege or check_violation then null; when others then if sqlerrm = 'Duda escreveu' then raise; end if;
  end;
  update public.dogs set name = 'Hack' where id = 'dddddddd-0000-4000-8000-0000000000ab';
  if (select name from public.dogs where id = 'dddddddd-0000-4000-8000-0000000000ab') <> 'Abu' then raise exception 'Duda renomeou o cachorro'; end if;
end $$;

-- Carla (de fora): nada.
set local "request.jwt.claim.sub" = '44444444-0000-4000-8000-000000000004';
set local "request.jwt.claims" = '{"sub":"44444444-0000-4000-8000-000000000004","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.dogs) + (select count(*) from public.weights) + (select count(*) from public.dog_members) <> 0 then raise exception 'Carla viu dados de outra família'; end if;
end $$;

reset role;
do $$ begin raise notice 'FAMÍLIA OK'; end $$;
rollback;
