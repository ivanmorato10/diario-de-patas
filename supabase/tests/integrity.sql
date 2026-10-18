-- Integridade: boas-vindas por conta, créditos do diário sobrevivem a quem comprou, estorno, convite
-- atômico, limite de lembranças no banco, aviso de arte e álbum único "Artes do Estúdio".
begin;
do $$
declare ivan uuid := gen_random_uuid(); bia uuid := gen_random_uuid(); d1 uuid := gen_random_uuid(); d2 uuid := gen_random_uuid();
  p uuid; n int; m uuid; dog uuid;
begin
  insert into auth.users (id, email) values (ivan, 'ivan-i@diariodepatas.test'), (bia, 'bia-i@diariodepatas.test');

  -- 17) boas-vindas: uma vez por conta, mesmo apagando o diário e criando outro
  insert into public.dogs (id, owner_id, name) values (d1, ivan, 'Abu');
  perform public.grant_welcome_credits(ivan, d1, 3);
  if public.credit_available_dog(d1) <> 3 then raise exception 'boas-vindas no 1º diário'; end if;
  delete from public.dogs where id = d1;
  insert into public.dogs (id, owner_id, name) values (d2, ivan, 'Pepe');
  perform public.grant_welcome_credits(ivan, d2, 3);
  if public.credit_available_dog(d2) <> 0 then raise exception 'apagar o diário não pode repetir as boas-vindas'; end if;
  -- limpar o marcador do próprio perfil (a pessoa pode editar o perfil) também não repete
  update public.profiles set welcome_credits_at = null where user_id = ivan;
  delete from public.profiles where user_id = ivan;
  perform public.grant_welcome_credits(ivan, d2, 3);
  if public.credit_available_dog(d2) <> 0 then raise exception 'editar o perfil não pode repetir as boas-vindas'; end if;

  -- 18) Bianca compra no diário do Ivan, parte é usada, Bianca exclui a conta: o saldo do diário fica
  insert into public.dog_members (dog_id, user_id, role) values (d2, bia, 'editor');
  insert into public.credit_purchases (owner_id, dog_id, package_id, credits, amount_cents, provider, provider_payment_id, idempotency_key, status)
    values (bia, d2, 'p5', 5, 490, 'teste', 'teste-bia', 'kb', 'approved') returning id into p;
  perform public.grant_purchase_credits(p);
  insert into public.credit_ledger (owner_id, dog_id, operation, amount, idempotency_key) values (ivan, d2, 'reserve', 2, 'reserve:teste');
  if public.credit_available_dog(d2) <> 3 then raise exception 'saldo antes: %', public.credit_available_dog(d2); end if;
  delete from auth.users where id = bia;
  if public.credit_available_dog(d2) <> 3 then raise exception 'excluir quem comprou mudou o saldo do diário (%)', public.credit_available_dog(d2); end if;
  if not exists (select 1 from public.credit_purchases where id = p and owner_id is null) then raise exception 'a compra deveria ficar no histórico'; end if;

  -- 16) estorno: retira só o que sobrou, uma vez, sem negativo
  n := public.revoke_purchase_credits(p);
  if n <> 3 or public.credit_available_dog(d2) <> 0 then raise exception 'estorno retirou % (saldo %)', n, public.credit_available_dog(d2); end if;
  -- repetir é seguro: devolve o mesmo valor e não desconta de novo
  if public.revoke_purchase_credits(p) <> 3 or public.credit_available_dog(d2) <> 0 then raise exception 'estorno não pode descontar duas vezes'; end if;
  if (select refund_applied_at from public.credit_purchases where id = p) is null then raise exception 'estorno aplicado deveria ficar marcado'; end if;

  -- 21) convite atômico e de uso único
  insert into auth.users (id, email) values (bia, 'bia-i2@diariodepatas.test');
  insert into public.dog_invites (dog_id, role, code_hash, created_by, expires_at) values (d2, 'viewer', 'hash-teste', ivan, now() + interval '1 day');
  dog := public.accept_invite('hash-teste', bia, '  Bia  ');
  if dog <> d2 or not exists (select 1 from public.dog_members where dog_id = d2 and user_id = bia and role = 'viewer') then raise exception 'convite não deu acesso'; end if;
  if (select display_name from public.profiles where user_id = bia) <> 'Bia' then raise exception 'nome do convite'; end if;
  if public.accept_invite('hash-teste', bia, null) <> d2 then raise exception 'repetir pela mesma pessoa deve ser seguro'; end if;
  begin
    perform public.accept_invite('hash-teste', ivan, null);
    raise exception 'convite usado duas vezes';
  exception when others then if sqlerrm <> 'INVALID_CODE' then raise; end if;
  end;

  -- removido não volta com o convite antigo
  delete from public.dog_members where dog_id = d2 and user_id = bia;
  begin
    perform public.accept_invite('hash-teste', bia, null);
    raise exception 'removido recuperou acesso com convite usado';
  exception when others then if sqlerrm <> 'INVALID_CODE' then raise; end if;
  end;
  if exists (select 1 from public.dog_members where dog_id = d2 and user_id = bia) then raise exception 'acesso recriado'; end if;

  -- 8) Estúdio: vaga e orçamento reservados ao criar o job (antes da IA)
  update public.app_limits set value = 100 where key = 'max_entries';
  perform public.create_studio_job(jsonb_build_object('owner_id', ivan, 'dog_id', d2, 'theme_id', 'aniversario', 'preset_version', 1, 'aspect', '1:1', 'model', 'm', 'credits', 1, 'cost_usd', 0.10, 'idempotency_key', 'aaaaaaaa-0000-4000-8000-000000000001'), 2, 0.15);
  if public.create_studio_job(jsonb_build_object('owner_id', ivan, 'dog_id', d2, 'theme_id', 'aniversario', 'preset_version', 1, 'aspect', '1:1', 'model', 'm', 'credits', 1, 'cost_usd', 0.10, 'idempotency_key', 'aaaaaaaa-0000-4000-8000-000000000001'), 2, 0.15)
     is distinct from (select id from public.generation_jobs where idempotency_key = 'aaaaaaaa-0000-4000-8000-000000000001') then raise exception 'toque duplo deveria devolver o mesmo job'; end if;
  begin
    perform public.create_studio_job(jsonb_build_object('owner_id', ivan, 'dog_id', d2, 'theme_id', 'aniversario', 'preset_version', 1, 'aspect', '1:1', 'model', 'm', 'credits', 1, 'cost_usd', 0.10, 'idempotency_key', 'aaaaaaaa-0000-4000-8000-000000000002'), 5, 0.15);
    raise exception 'passou do orçamento';
  exception when others then if sqlerrm <> 'BUDGET' then raise; end if;
  end;
  begin
    perform public.create_studio_job(jsonb_build_object('owner_id', ivan, 'dog_id', d2, 'theme_id', 'aniversario', 'preset_version', 1, 'aspect', '1:1', 'model', 'm', 'credits', 1, 'cost_usd', 0.01, 'idempotency_key', 'aaaaaaaa-0000-4000-8000-000000000003'), 1, null);
    raise exception 'passou da vaga (arte em andamento ocupa vaga)';
  exception when others then if sqlerrm <> 'NO_SPACE' then raise; end if;
  end;
  delete from public.generation_jobs where dog_id = d2;

  -- 24) limite no banco
  update public.app_limits set value = 1 where key = 'max_entries';
  insert into public.media_assets (id, owner_id, dog_id, private_storage_key, mime, bytes, width, height, hash, status)
    values (gen_random_uuid(), ivan, d2, 'i/1.webp', 'image/webp', 1, 1, 1, 'h1', 'ready') returning id into m;
  insert into public.diary_entries (owner_id, dog_id, media_asset_id, occurred_date, timezone, source, request_key) values (ivan, d2, m, '2026-10-17', 'UTC', 'free', gen_random_uuid());
  begin
    insert into public.diary_entries (owner_id, dog_id, media_asset_id, occurred_date, timezone, source, request_key) values (ivan, d2, m, '2026-10-17', 'UTC', 'free', gen_random_uuid());
    raise exception 'passou do limite';
  exception when others then if sqlerrm <> 'STORAGE_QUOTA' then raise; end if;
  end;
  update public.app_limits set value = 100 where key = 'max_entries';

  -- 7) arte em andamento segura a sua vaga: foto comum não ocupa; a própria arte usa a vaga
  update public.app_limits set value = 2 where key = 'max_entries';
  insert into public.generation_jobs (id, owner_id, dog_id, theme_id, preset_version, aspect, model, credits, cost_usd, idempotency_key)
    values ('bbbbbbbb-0000-4000-8000-000000000001', ivan, d2, 'aniversario', 1, '1:1', 'm', 1, 0.01, 'bbbbbbbb-0000-4000-8000-000000000002');
  begin
    insert into public.diary_entries (owner_id, dog_id, media_asset_id, occurred_date, timezone, source, request_key) values (ivan, d2, m, '2026-10-17', 'UTC', 'free', gen_random_uuid());
    raise exception 'foto comum ocupou a vaga reservada para a arte';
  exception when others then if sqlerrm <> 'STORAGE_QUOTA' then raise; end if;
  end;
  insert into public.diary_entries (owner_id, dog_id, media_asset_id, occurred_date, timezone, source, request_key) values (ivan, d2, m, '2026-10-17', 'UTC', 'studio', 'bbbbbbbb-0000-4000-8000-000000000001');
  delete from public.generation_jobs where dog_id = d2;
  update public.app_limits set value = 100 where key = 'max_entries';

  -- 6) análise de foto entra no teto do dia
  insert into public.photo_checks (asset_id, crop_key, result, cost_usd, requested_by) values (m, 'full', '{}', 0.2, ivan);
  begin
    perform public.create_studio_job(jsonb_build_object('owner_id', ivan, 'dog_id', d2, 'theme_id', 'aniversario', 'preset_version', 1, 'aspect', '1:1', 'model', 'm', 'credits', 1, 'cost_usd', 0.01, 'idempotency_key', 'aaaaaaaa-0000-4000-8000-000000000009'), 100, 0.15);
    raise exception 'análises de foto deveriam contar no teto';
  exception when others then if sqlerrm <> 'BUDGET' then raise; end if;
  end;
  delete from public.photo_checks where asset_id = m;

  -- 11) aviso de arte
  insert into public.notifications (user_id, dog_id, actor_id, kind) values (bia, d2, ivan, 'art');

  -- 10) um só álbum "Artes do Estúdio" por cachorro
  insert into public.albums (owner_id, dog_id, title, type, system_key) values (ivan, d2, 'Artes do Estúdio', 'custom', 'studio') on conflict do nothing;
  insert into public.albums (owner_id, dog_id, title, type, system_key) values (ivan, d2, 'Artes do Estúdio', 'custom', 'studio') on conflict do nothing;
  if (select count(*) from public.albums where dog_id = d2 and system_key = 'studio') <> 1 then raise exception 'álbum de artes duplicado'; end if;
  raise notice 'INTEGRIDADE OK';
end $$;
rollback;
