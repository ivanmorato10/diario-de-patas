-- Créditos do Estúdio (MUDANCAS-V2 §9.2): reserva antes, consumo depois de salvar, liberação em falha.
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-0000000000c1', 'studio@example.test');
do $$
declare
  o uuid := 'aaaaaaaa-0000-4000-8000-0000000000c1';
  j1 uuid := gen_random_uuid(); j2 uuid := gen_random_uuid(); j3 uuid := gen_random_uuid();
begin
  perform public.grant_test_credits(o, 5);
  perform public.grant_test_credits(o, 5); -- concedido uma única vez
  if public.credit_available(o) <> 5 then raise exception 'FALHOU: créditos de teste duplicados'; end if;
  insert into public.generation_jobs (id, owner_id, theme_id, idempotency_key) values (j1, o, 'aniversario', gen_random_uuid()), (j2, o, 'natal', gen_random_uuid()), (j3, o, 'realeza', gen_random_uuid());
  if not public.reserve_credit(o, j1, 1) then raise exception 'FALHOU: reserva'; end if;
  if not public.reserve_credit(o, j1, 1) then raise exception 'FALHOU: reserva idempotente'; end if; -- duplo clique
  if public.credit_available(o) <> 4 then raise exception 'FALHOU: reserva cobrou duas vezes'; end if;
  if not public.settle_credit(j1, 'consume') then raise exception 'FALHOU: consumo'; end if;
  if public.settle_credit(j1, 'release') then raise exception 'FALHOU: liberou depois de consumir'; end if;
  if public.settle_credit(j1, 'consume') then raise exception 'FALHOU: consumiu duas vezes'; end if;
  if public.credit_available(o) <> 4 then raise exception 'FALHOU: saldo após consumo'; end if;
  perform public.reserve_credit(o, j2, 1);
  if not public.settle_credit(j2, 'release') then raise exception 'FALHOU: liberação'; end if; -- falha devolve
  if public.credit_available(o) <> 4 then raise exception 'FALHOU: falha não devolveu o crédito'; end if;
  if not public.reserve_credit(o, j3, 4) then raise exception 'FALHOU: reserva premium'; end if;
  if public.reserve_credit(o, gen_random_uuid(), 1) then raise exception 'FALHOU: reservou sem saldo'; end if;
  if public.credit_available(o) <> 0 then raise exception 'FALHOU: saldo negativo ou errado'; end if;
  raise notice 'ESTÚDIO OK';
end $$;
rollback;
