-- Reserva da análise paga de foto: limite por pessoa por dia e teto de gasto do dia, antes de chamar a IA.
do $$
declare u uuid := gen_random_uuid(); v uuid := gen_random_uuid(); ok boolean;
begin
  insert into auth.users (id, email) values (u, 'reserva-u@teste'), (v, 'reserva-v@teste');
  -- limite de 2 por dia para u
  if not reserve_photo_check(u, 0.001, 2, null) then raise exception 'primeira reserva deveria passar'; end if;
  if not reserve_photo_check(u, 0.001, 2, null) then raise exception 'segunda reserva deveria passar'; end if;
  if reserve_photo_check(u, 0.001, 2, null) then raise exception 'terceira reserva passou do limite'; end if;
  -- outra pessoa tem o próprio limite
  if not reserve_photo_check(v, 0.001, 2, null) then raise exception 'limite é por pessoa'; end if;
  -- teto do dia: com o gasto atual, um teto menor que gasto + custo recusa
  ok := reserve_photo_check(v, 1000, 10, studio_spent_today_usd() + 999);
  if ok then raise exception 'teto do dia não foi respeitado'; end if;
  -- tentativa reservada conta no gasto do dia mesmo sem resultado
  if (select count(*) from photo_check_spend where requested_by = u) <> 2 then raise exception 'reservas não registradas'; end if;
  raise notice 'RESERVA DE ANÁLISE OK';
end $$;
