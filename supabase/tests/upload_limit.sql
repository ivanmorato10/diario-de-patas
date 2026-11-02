-- Revisão de segurança S04: pedidos de envio limitados por pessoa (janela de 10 min e dia), contados à parte para
-- cada conta, e a função só para o servidor. Falha = exceção. Sucesso = NOTICE "UPLOAD LIMIT OK". Desfaz no fim.
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-0000000000a6', 'ul-a@example.test'), ('bbbbbbbb-0000-4000-8000-0000000000b6', 'ul-b@example.test');
update public.app_limits set value = 3 where key = 'uploads_per_10min';
update public.app_limits set value = 5 where key = 'uploads_per_day';
do $$
declare i int; ok boolean;
begin
  for i in 1..3 loop
    if not public.take_upload_ticket('aaaaaaaa-0000-4000-8000-0000000000a6') then raise exception 'FALHOU: pedido % de A deveria caber', i; end if;
  end loop;
  if public.take_upload_ticket('aaaaaaaa-0000-4000-8000-0000000000a6') then raise exception 'FALHOU: 4º pedido em 10 min passou'; end if;
  if not public.take_upload_ticket('bbbbbbbb-0000-4000-8000-0000000000b6') then raise exception 'FALHOU: limite de A bloqueou B'; end if;
  -- Janela de 10 minutos nova, mas o limite do dia continua contando (A já fez 4 pedidos hoje).
  update public.upload_tickets set window_key = 'm:0' where user_id = 'aaaaaaaa-0000-4000-8000-0000000000a6' and window_key like 'm:%';
  if not public.take_upload_ticket('aaaaaaaa-0000-4000-8000-0000000000a6') then raise exception 'FALHOU: janela nova deveria liberar'; end if;
  if public.take_upload_ticket('aaaaaaaa-0000-4000-8000-0000000000a6') then raise exception 'FALHOU: passou do limite do dia'; end if;
end $$;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-0000-4000-8000-0000000000a6';
do $$ begin
  begin
    perform public.take_upload_ticket('aaaaaaaa-0000-4000-8000-0000000000a6');
    raise exception 'FALHOU: sessão chamou a função de cota';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.upload_tickets;
    raise exception 'FALHOU: sessão leu a tabela de cota';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin raise notice 'UPLOAD LIMIT OK'; end $$;
rollback;
