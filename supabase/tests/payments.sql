-- Compra aprovada concede créditos UMA vez ao diário da compra; pendente não concede; outro diário não ganha.
do $$
declare u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); d1 uuid := gen_random_uuid(); d2 uuid := gen_random_uuid(); p uuid; n int;
begin
  insert into auth.users (id, email) values (u1, 'pay1@diariodepatas.test'), (u2, 'pay2@diariodepatas.test');
  insert into public.dogs (id, owner_id, name) values (d1, u1, 'Abu'), (d2, u2, 'Thor');
  insert into public.credit_purchases (owner_id, dog_id, package_id, credits, amount_cents, provider, provider_payment_id, idempotency_key)
  values (u1, d1, 'p15', 15, 790, 'teste', 'teste-1', 'k1') returning id into p;
  if public.grant_purchase_credits(p) then raise exception 'pendente não deveria conceder'; end if;
  if public.credit_available_dog(d1) <> 0 then raise exception 'saldo deveria ser 0'; end if;
  update public.credit_purchases set status = 'approved' where id = p;
  perform public.grant_purchase_credits(p);
  perform public.grant_purchase_credits(p);
  n := public.credit_available_dog(d1);
  if n <> 15 then raise exception 'esperava 15 créditos, veio %', n; end if;
  if public.credit_available_dog(d2) <> 0 then raise exception 'outro diário não pode ganhar créditos'; end if;
  raise notice 'PAGAMENTOS OK';
end $$;
