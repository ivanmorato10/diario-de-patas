-- Diário de Patas — contas reais (MUDANCAS-V2 §8): regras do servidor que faltavam.
-- STATUS: escrito e testado num Postgres 16 local (stub de auth/storage); NÃO aplicado no Supabase.

-- ---------- Posse coerente: o cachorro referenciado precisa ser do próprio dono ----------
drop policy own_albums on public.albums;
create policy own_albums on public.albums for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid()));

-- A foto de perfil do cachorro precisa ser uma mídia do próprio dono.
create or replace function public.check_dog_photo_owner() returns trigger language plpgsql as $$
begin
  if new.photo_asset_id is not null and not exists (
    select 1 from public.media_assets m where m.id = new.photo_asset_id and m.owner_id = new.owner_id
  ) then raise exception 'FOREIGN_MEDIA'; end if;
  return new;
end $$;
create trigger dogs_photo_owner before insert or update of photo_asset_id on public.dogs
  for each row execute function public.check_dog_photo_owner();

-- ---------- Limpeza de arquivos (órfãos e exclusões) ----------
-- O servidor consome esta fila e apaga os objetos dos buckets `media` e `documents`.
create table public.storage_cleanup (
  id bigint generated always as identity primary key,
  bucket text not null check (bucket in ('media', 'documents')),
  object_key text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.storage_cleanup enable row level security; -- sem política: só o servidor

-- ---------- Conclusão de missão no servidor (§1, §7) ----------
-- Idempotente por request_key; XP por instância (period_key); uma foto pontua uma única vez;
-- missão do dia só se estiver no plano de hoje; avanço de coleção sem XP; medalha via award_medal.
-- p_today vem do servidor (data civil no fuso do perfil), nunca do cliente.
create or replace function public.confirm_mission(
  p_owner uuid, p_dog uuid, p_template text, p_entry uuid, p_request_key uuid,
  p_approved boolean, p_today date, p_period text
) returns table (xp_awarded integer, already_completed boolean, medals text[])
language plpgsql security definer set search_path = public as $$
declare
  t public.mission_templates;
  v_period text;
  v_instance uuid;
  v_sub uuid;
  v_completion uuid;
  v_xp integer := 0;
  v_medals text[] := '{}';
  v_set record;
begin
  if not exists (select 1 from dogs where id = p_dog and owner_id = p_owner) then raise exception 'NOT_FOUND'; end if;
  if not exists (select 1 from diary_entries where id = p_entry and owner_id = p_owner and dog_id = p_dog and deleted_at is null) then raise exception 'NOT_FOUND'; end if;
  if exists (select 1 from diary_entries where id = p_entry and source = 'studio') then raise exception 'ART_NOT_ALLOWED'; end if;
  select * into t from mission_templates where id = p_template and active;
  if not found then raise exception 'UNKNOWN_MISSION'; end if;

  -- Retry com a mesma chave devolve o resultado anterior, sem novo XP.
  select id into v_sub from mission_submissions where owner_id = p_owner and request_key = p_request_key;
  if found then return query select 0, true, '{}'::text[]; return; end if;

  if t.prerequisite_id is not null and not exists (
    select 1 from mission_completions c join mission_instances i on i.id = c.instance_id where i.dog_id = p_dog and i.template_id = t.prerequisite_id
  ) then raise exception 'LOCKED'; end if;

  v_period := case t.kind when 'daily' then p_today::text when 'special' then p_period else 'once' end;
  if t.kind = 'daily' and not exists (
    select 1 from daily_plans where dog_id = p_dog and plan_date = p_today and t.id in (slots ->> 'A', slots ->> 'B', slots ->> 'C')
  ) then raise exception 'NOT_TODAY'; end if;
  if t.kind = 'special' and (p_period is null or p_period !~ '^\d{4}$') then raise exception 'OUT_OF_WINDOW'; end if; -- janela conferida pelo servidor antes da chamada

  -- Serializa por cachorro: conclusões e medalhas simultâneas não duplicam.
  perform pg_advisory_xact_lock(hashtext('dog:' || p_dog::text));

  if p_approved and exists (
    select 1 from mission_submissions s join mission_completions c on c.accepted_submission_id = s.id join mission_instances i on i.id = c.instance_id
    where s.entry_id = p_entry and not (i.template_id = t.id and i.period_key = v_period)
  ) then raise exception 'PHOTO_ALREADY_USED'; end if;

  insert into mission_instances (dog_id, template_id, period_key) values (p_dog, t.id, v_period)
  on conflict (dog_id, template_id, period_key) do update set status = mission_instances.status
  returning id into v_instance;

  insert into mission_submissions (owner_id, instance_id, entry_id, status, reason_code, request_key)
  values (p_owner, v_instance, p_entry, case when p_approved then 'approved' else 'uncertain' end,
          case when p_approved then 'OWNER_CONFIRMED' else 'OWNER_UNSURE' end, p_request_key)
  returning id into v_sub;

  if not p_approved then return query select 0, false, '{}'::text[]; return; end if;

  insert into mission_completions (instance_id, accepted_submission_id) values (v_instance, v_sub)
  on conflict (instance_id) do nothing returning id into v_completion;
  if v_completion is null then return query select 0, true, '{}'::text[]; return; end if;

  insert into xp_ledger (dog_id, completion_id, amount, reason) values (p_dog, v_completion, t.xp, 'mission:' || t.id);
  v_xp := t.xp;
  update diary_entries set source = 'mission' where id = p_entry;

  if t.advances_item is not null and not exists (
    select 1 from mission_completions c join mission_instances i on i.id = c.instance_id where i.dog_id = p_dog and i.template_id = t.advances_item
  ) then
    insert into collection_advances (dog_id, owner_id, item_id, entry_id, via_mission_id) values (p_dog, p_owner, t.advances_item, p_entry, t.id)
    on conflict do nothing;
  end if;

  -- Coleções que contêm a missão (ou o item avançado) e ficaram completas.
  for v_set in
    select s.set_id from public.permanent_set_items s
    where s.item_id in (t.id, coalesce(t.advances_item, '-'))
    group by s.set_id
  loop
    if (select count(*) from public.permanent_set_items s where s.set_id = v_set.set_id and (
          exists (select 1 from mission_completions c join mission_instances i on i.id = c.instance_id where i.dog_id = p_dog and i.template_id = s.item_id)
          or exists (select 1 from collection_advances a where a.dog_id = p_dog and a.item_id = s.item_id))) = 6
       and public.award_medal(p_dog, p_owner, v_set.set_id) then
      v_xp := v_xp + 50;
      v_medals := v_medals || v_set.set_id;
    end if;
  end loop;
  return query select v_xp, false, v_medals;
end $$;
revoke all on function public.confirm_mission(uuid, uuid, text, uuid, uuid, boolean, date, text) from public, anon, authenticated;

-- Itens das coleções permanentes (espelha PERMANENT_SETS em src/config/cycle.ts).
create table public.permanent_set_items (
  set_id text not null,
  item_id text not null references public.mission_templates (id),
  primary key (set_id, item_id)
);
alter table public.permanent_set_items enable row level security;
create policy set_items_read on public.permanent_set_items for select using (true);

-- ---------- Links compartilhados (§12 do briefing) ----------
-- Página pública /s/:token: o servidor calcula sha256(token) e chama esta função.
-- Devolve só a seleção, nunca saúde, documentos, email ou IDs do dono. Link revogado/expirado → nada.
create or replace function public.resolve_share(p_token_hash text)
returns table (title text, entry_id uuid, caption text, occurred_date date, media_storage_key text, sort_order integer)
language sql stable security definer set search_path = public as $$
  select s.title, e.id, e.caption, e.occurred_date, m.private_storage_key, se.sort_order
  from share_links s
  join share_link_entries se on se.share_link_id = s.id
  join diary_entries e on e.id = se.entry_id and e.deleted_at is null
  join media_assets m on m.id = e.media_asset_id and m.status = 'ready'
  where s.token_hash = p_token_hash and s.revoked_at is null and (s.expires_at is null or s.expires_at > now())
  order by se.sort_order
$$;
revoke all on function public.resolve_share(text) from public, anon, authenticated;

-- ---------- Exclusão de conta (§8.2) ----------
-- Corta o acesso aos links, cancela jobs e enfileira os arquivos para apagar; depois o servidor
-- remove o usuário em auth.users (cascata apaga as linhas) e esvazia a fila de limpeza.
create or replace function public.prepare_account_deletion(p_owner uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update share_links set revoked_at = now() where owner_id = p_owner and revoked_at is null;
  update generation_jobs set state = 'cancelled', updated_at = now() where owner_id = p_owner and state in ('queued', 'processing');
  insert into storage_cleanup (bucket, object_key, reason)
    select 'media', k, 'account_deleted' from media_assets m, lateral (values (m.private_storage_key), (m.thumb_storage_key)) v(k) where m.owner_id = p_owner and k is not null
    union all
    select 'documents', k, 'account_deleted' from documents d, lateral (values (d.private_storage_key), (d.thumb_storage_key)) v(k) where d.owner_id = p_owner and k is not null;
  get diagnostics n = row_count;
  update media_assets set status = 'deleted' where owner_id = p_owner;
  update documents set status = 'deleted' where owner_id = p_owner;
  return n;
end $$;
revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
