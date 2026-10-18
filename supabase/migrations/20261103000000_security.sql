-- Revisão de segurança (18/10/2026).

-- 1) Convite já usado NUNCA recria acesso. Repetir o código só confirma uma participação que ainda existe;
--    quem foi removido não volta com o código antigo (precisa de um convite novo).
create or replace function public.accept_invite(p_code_hash text, p_user uuid, p_name text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.dog_invites;
begin
  select * into inv from dog_invites where code_hash = p_code_hash for update;
  if not found or inv.expires_at < now() then raise exception 'INVALID_CODE'; end if;
  if inv.used_at is not null then
    if inv.used_by = p_user and exists (select 1 from dog_members where dog_id = inv.dog_id and user_id = p_user) then
      return inv.dog_id; -- repetição segura (toque duplo, rede): já participa
    end if;
    raise exception 'INVALID_CODE';
  end if;
  insert into dog_members (dog_id, user_id, role, invited_by) values (inv.dog_id, p_user, inv.role, inv.created_by)
    on conflict (dog_id, user_id) do nothing;
  update dog_invites set used_at = now(), used_by = p_user where id = inv.id;
  insert into profiles (user_id, current_dog_id) values (p_user, inv.dog_id)
    on conflict (user_id) do update set current_dog_id = excluded.current_dog_id;
  if nullif(btrim(coalesce(p_name, '')), '') is not null then
    update profiles set display_name = left(regexp_replace(btrim(p_name), '\s+', ' ', 'g'), 40), name_confirmed = true where user_id = p_user;
  end if;
  return inv.dog_id;
end $$;

-- 3) Estorno recuperável: refund_applied_at só é preenchido quando o desconto foi aplicado (mesmo que 0).
--    Enquanto estiver vazio, toda reconciliação tenta de novo. O desconto é idempotente.
alter table public.credit_purchases add column if not exists refund_applied_at timestamptz;
alter table public.credit_purchases add column if not exists refund_credits_taken integer;

create or replace function public.revoke_purchase_credits(p_purchase uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare p public.credit_purchases; avail integer; take integer; o uuid;
begin
  perform pg_advisory_xact_lock(hashtext('purchase:' || p_purchase::text));
  select * into p from credit_purchases where id = p_purchase;
  if not found then return 0; end if;
  if p.refund_applied_at is not null then return coalesce(p.refund_credits_taken, 0); end if;
  take := 0;
  if p.dog_id is not null and exists (select 1 from credit_ledger where idempotency_key = 'purchase:' || p.id) then
    perform pg_advisory_xact_lock(hashtext('credits:' || p.dog_id::text));
    -- Regra (a aprovar pelo proprietário): retira do SALDO DISPONÍVEL do diário até o valor da compra;
    -- não identifica quais créditos daquela compra já viraram arte. Nunca deixa saldo negativo.
    avail := credit_available_dog(p.dog_id);
    take := greatest(0, least(p.credits, avail));
    if take > 0 then
      select owner_id into o from dogs where id = p.dog_id;
      insert into credit_ledger (owner_id, dog_id, operation, amount, payment_id, idempotency_key)
        values (o, p.dog_id, 'revoke', take, p.provider || ':' || coalesce(p.provider_payment_id, p.id::text), 'purchase-refund:' || p.id)
        on conflict (idempotency_key) do nothing;
    end if;
  end if;
  update credit_purchases set refund_applied_at = now(), refund_credits_taken = take where id = p.id;
  return take;
end $$;

-- 8) Estúdio: reserva a vaga no diário e o orçamento do dia ANTES de qualquer chamada paga, criando o
--    job sob trava. Arte em andamento ocupa vaga; custo estimado de jobs na fila conta no orçamento.
create or replace function public.create_studio_job(p_job jsonb, p_max_entries integer, p_budget_usd numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare d uuid := (p_job ->> 'dog_id')::uuid; existing uuid; used integer; spent numeric; new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('entries:' || d));
  if p_budget_usd is not null and p_budget_usd > 0 then perform pg_advisory_xact_lock(hashtext('studio-budget')); end if;
  -- Toque duplo: o mesmo pedido devolve o mesmo job.
  select id into existing from generation_jobs where owner_id = (p_job ->> 'owner_id')::uuid and idempotency_key = (p_job ->> 'idempotency_key')::uuid;
  if found then return existing; end if;
  select (select count(*) from diary_entries where dog_id = d and deleted_at is null)
       + (select count(*) from generation_jobs where dog_id = d and state in ('queued', 'processing')) into used;
  if used >= p_max_entries then raise exception 'NO_SPACE'; end if;
  if p_budget_usd is not null and p_budget_usd > 0 then
    select coalesce(sum(cost_usd), 0) into spent from generation_jobs
      where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
        and (state in ('queued', 'processing', 'succeeded') or (state = 'failed' and coalesce(failure_code, '') not in ('NO_CREDITS', 'INPUT_DELETED', 'NOT_CONFIGURED', 'NO_SPACE', 'PHOTO_UNSUITABLE')));
    if spent + coalesce((p_job ->> 'cost_usd')::numeric, 0) > p_budget_usd then raise exception 'BUDGET'; end if;
  end if;
  -- Só as colunas informadas: as demais (id, estado, datas) ficam com o padrão da tabela.
  insert into generation_jobs (owner_id, dog_id, requested_by, input_entry_id, input_asset_id, theme_id, preset_version, aspect, crop, overlay, model, credits, cost_usd, idempotency_key)
    select r.owner_id, r.dog_id, r.requested_by, r.input_entry_id, r.input_asset_id, r.theme_id, r.preset_version, r.aspect, r.crop, r.overlay, r.model, r.credits, r.cost_usd, r.idempotency_key
    from jsonb_populate_record(null::generation_jobs, p_job) r
    returning id into new_id;
  return new_id;
end $$;

revoke all on function public.accept_invite(text, uuid, text), public.revoke_purchase_credits(uuid), public.create_studio_job(jsonb, integer, numeric)
  from public, anon, authenticated;
