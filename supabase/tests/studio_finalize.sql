-- Estúdio, conclusão atômica (finalize_studio_job): ou entrega + consumo + concluída, ou nada; repetir não duplica.
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-0000000000f1', 'finalize@example.test');
do $$
declare
  o uuid := 'aaaaaaaa-0000-4000-8000-0000000000f1';
  d uuid := gen_random_uuid(); alb uuid := gen_random_uuid();
  j uuid := gen_random_uuid(); jbad uuid := gen_random_uuid();
  m1 uuid := gen_random_uuid(); m2 uuid := gen_random_uuid();
  e1 uuid; e2 uuid; n integer; st text;
begin
  insert into public.dogs (id, owner_id, name) values (d, o, 'Abu');
  insert into public.albums (id, owner_id, dog_id, title, type) values (alb, o, d, 'Arte', 'custom');
  perform public.grant_welcome_credits(o, d, 3);
  insert into public.generation_jobs (id, owner_id, dog_id, requested_by, theme_id, idempotency_key, state)
    values (j, o, d, o, 'aniversario', gen_random_uuid(), 'processing'), (jbad, o, d, o, 'natal', gen_random_uuid(), 'processing');
  if not public.reserve_credit_dog(d, o, j, 1) then raise exception 'FALHOU: reserva'; end if;
  if not public.reserve_credit_dog(d, o, jbad, 1) then raise exception 'FALHOU: reserva 2'; end if;

  -- 1) Conclusão: arte no Diário + álbum + crédito consumido + job concluído.
  e1 := public.finalize_studio_job(j, jsonb_build_object('id', m1, 'private_storage_key', 'o/m1.webp', 'thumb_storage_key', 'o/m1-t.webp', 'bytes', 10, 'width', 1, 'height', 1, 'hash', 'h1'),
                                   jsonb_build_object('caption', 'Arte', 'occurred_date', '2026-10-20', 'timezone', 'UTC'), alb, 'modelo');
  select state into st from public.generation_jobs where id = j;
  if st <> 'succeeded' then raise exception 'FALHOU: job não concluído (%)', st; end if;
  if not exists (select 1 from public.album_entries where album_id = alb and entry_id = e1) then raise exception 'FALHOU: arte fora do álbum'; end if;
  if not exists (select 1 from public.credit_ledger where idempotency_key = 'consume:' || j) then raise exception 'FALHOU: crédito não consumido'; end if;

  -- 2) Repetir a conclusão: mesma lembrança, sem duplicar arte, álbum ou consumo.
  e2 := public.finalize_studio_job(j, jsonb_build_object('id', gen_random_uuid(), 'private_storage_key', 'o/x.webp', 'thumb_storage_key', 'o/x-t.webp', 'bytes', 10, 'width', 1, 'height', 1, 'hash', 'hx'),
                                   jsonb_build_object('caption', 'Arte', 'occurred_date', '2026-10-20', 'timezone', 'UTC'), alb, 'modelo');
  if e2 <> e1 then raise exception 'FALHOU: repetição criou outra lembrança'; end if;
  select count(*) into n from public.diary_entries where request_key = j; if n <> 1 then raise exception 'FALHOU: % lembranças', n; end if;
  select count(*) into n from public.credit_ledger where idempotency_key = 'consume:' || j; if n <> 1 then raise exception 'FALHOU: consumo duplicado'; end if;

  -- 3) Falha no meio (álbum inexistente): nada fica — sem mídia, sem lembrança, sem consumo; job continua em andamento.
  begin
    perform public.finalize_studio_job(jbad, jsonb_build_object('id', m2, 'private_storage_key', 'o/m2.webp', 'thumb_storage_key', 'o/m2-t.webp', 'bytes', 10, 'width', 1, 'height', 1, 'hash', 'h2'),
                                       jsonb_build_object('caption', 'Arte', 'occurred_date', '2026-10-20', 'timezone', 'UTC'), gen_random_uuid(), 'modelo');
    raise exception 'FALHOU: deveria ter dado erro';
  exception when foreign_key_violation then null;
  end;
  if exists (select 1 from public.media_assets where id = m2) then raise exception 'FALHOU: mídia ficou sem conclusão'; end if;
  if exists (select 1 from public.diary_entries where request_key = jbad) then raise exception 'FALHOU: lembrança ficou sem conclusão'; end if;
  if exists (select 1 from public.credit_ledger where idempotency_key = 'consume:' || jbad) then raise exception 'FALHOU: consumiu sem entregar'; end if;
  select state into st from public.generation_jobs where id = jbad; if st <> 'processing' then raise exception 'FALHOU: estado mudou (%)', st; end if;
  -- e a falha devolve a reserva normalmente
  if not public.settle_credit(jbad, 'release') then raise exception 'FALHOU: não devolveu a reserva'; end if;
  raise notice 'CONCLUSÃO DO ESTÚDIO OK';
end $$;
rollback;
