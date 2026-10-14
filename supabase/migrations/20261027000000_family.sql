-- Diário de Patas — vários cachorros por pessoa e família (administrador, pode editar, só ver).
--
-- Modelo:
--  * Cada cachorro = um diário. dogs.owner_id = administrador original ("dono do diário").
--  * dog_members: quem participa de cada diário e com qual papel. O criador entra como admin.
--  * Em TODAS as tabelas de conteúdo, owner_id continua sendo o dono do diário (assim as funções de missão,
--    créditos e exclusão seguem iguais); created_by guarda QUEM fez (para "guardada por Bianca").
--  * Permissões (RLS) passam a ser por cachorro: ler = membro; escrever = admin ou editor.
--  * Créditos do Estúdio são do diário (credit_ledger.dog_id).

-- Vários cachorros por pessoa: sai a regra antiga de um cachorro por dono.
drop index if exists public.dogs_one_per_owner;
alter table public.dogs drop constraint if exists dogs_one_per_owner;

-- ---------- Membros ----------
create table if not exists public.dog_members (
  dog_id uuid not null references public.dogs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (dog_id, user_id)
);
create index if not exists dog_members_by_user on public.dog_members (user_id);
insert into public.dog_members (dog_id, user_id, role) select id, owner_id, 'admin' from public.dogs on conflict do nothing;

-- Todo cachorro novo já nasce com o criador como administrador.
create or replace function public.dog_owner_is_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into dog_members (dog_id, user_id, role) values (new.id, new.owner_id, 'admin') on conflict do nothing;
  return new;
end $$;
drop trigger if exists dog_owner_is_admin on public.dogs;
create trigger dog_owner_is_admin after insert on public.dogs for each row execute function public.dog_owner_is_admin();

-- Convites: código curto (hash), papel, validade e uso único.
create table if not exists public.dog_invites (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  code_hash text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.dog_invites enable row level security; -- só o servidor

-- Perfil: diário aberto agora e nome para "guardada por".
alter table public.profiles
  add column if not exists current_dog_id uuid references public.dogs (id) on delete set null,
  add column if not exists display_name text not null default '' check (char_length(display_name) <= 60);

-- Quem fez (autor), separado do dono do diário.
alter table public.diary_entries add column if not exists created_by uuid references auth.users (id) on delete set null;
update public.diary_entries set created_by = owner_id where created_by is null;

-- dog_id onde faltava (um diário por dono até hoje: preenche com o cachorro do dono).
alter table public.share_links add column if not exists dog_id uuid references public.dogs (id) on delete cascade;
alter table public.credit_ledger add column if not exists dog_id uuid references public.dogs (id) on delete cascade;
alter table public.credit_purchases add column if not exists dog_id uuid references public.dogs (id) on delete cascade;
alter table public.mission_submissions add column if not exists dog_id uuid references public.dogs (id) on delete cascade;
update public.share_links s set dog_id = d.id from public.dogs d where s.dog_id is null and d.owner_id = s.owner_id;
update public.credit_ledger c set dog_id = d.id from public.dogs d where c.dog_id is null and d.owner_id = c.owner_id;
update public.credit_purchases c set dog_id = d.id from public.dogs d where c.dog_id is null and d.owner_id = c.owner_id;
update public.mission_submissions m set dog_id = i.dog_id from public.mission_instances i where m.dog_id is null and i.id = m.instance_id;
create index if not exists credit_ledger_by_dog on public.credit_ledger (dog_id);

-- ---------- Funções de acesso (usadas nas políticas) ----------
create or replace function public.dog_role(p_dog uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from dog_members where dog_id = p_dog and user_id = (select auth.uid())
$$;
create or replace function public.is_dog_member(p_dog uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from dog_members where dog_id = p_dog and user_id = (select auth.uid()))
$$;
create or replace function public.can_edit_dog(p_dog uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from dog_members where dog_id = p_dog and user_id = (select auth.uid()) and role in ('admin', 'editor'))
$$;
grant execute on function public.dog_role(uuid), public.is_dog_member(uuid), public.can_edit_dog(uuid) to authenticated;

-- ---------- Políticas: troca "dono = eu" por "membro do cachorro" ----------
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in (
    'dogs', 'media_assets', 'diary_entries', 'mission_instances', 'mission_submissions', 'mission_completions', 'xp_ledger',
    'albums', 'album_entries', 'share_links', 'share_link_entries', 'generation_jobs', 'credit_ledger', 'health_profiles',
    'weights', 'vaccines', 'visits', 'medications', 'contacts', 'documents', 'visit_documents', 'daily_plans',
    'collection_advances', 'medals', 'credit_purchases', 'dog_members')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.dog_members enable row level security;
create policy members_read on public.dog_members for select using (public.is_dog_member(dog_id));

create policy dogs_read on public.dogs for select using (public.is_dog_member(id) or owner_id = (select auth.uid()));
create policy dogs_insert on public.dogs for insert with check (owner_id = (select auth.uid()));
create policy dogs_update on public.dogs for update using (public.can_edit_dog(id)) with check (public.can_edit_dog(id));
create policy dogs_delete on public.dogs for delete using (public.dog_role(id) = 'admin');

create policy media_read on public.media_assets for select using (public.is_dog_member(dog_id) or (dog_id is null and owner_id = (select auth.uid())));
create policy entries_read on public.diary_entries for select using (public.is_dog_member(dog_id) and deleted_at is null);
create policy entries_update on public.diary_entries for update using (public.can_edit_dog(dog_id)) with check (public.can_edit_dog(dog_id));
create policy instances_read on public.mission_instances for select using (public.is_dog_member(dog_id));
create policy submissions_read on public.mission_submissions for select using (public.is_dog_member(dog_id));
create policy completions_read on public.mission_completions for select using (exists (select 1 from public.mission_instances i where i.id = instance_id and public.is_dog_member(i.dog_id)));
create policy xp_read on public.xp_ledger for select using (public.is_dog_member(dog_id));
create policy albums_read on public.albums for select using (public.is_dog_member(dog_id));
create policy albums_write on public.albums for all using (public.can_edit_dog(dog_id)) with check (public.can_edit_dog(dog_id));
create policy album_entries_read on public.album_entries for select using (exists (select 1 from public.albums a where a.id = album_id and public.is_dog_member(a.dog_id)));
create policy album_entries_write on public.album_entries for all
  using (exists (select 1 from public.albums a where a.id = album_id and public.can_edit_dog(a.dog_id)))
  with check (exists (select 1 from public.albums a where a.id = album_id and public.can_edit_dog(a.dog_id)));
create policy shares_read on public.share_links for select using (public.is_dog_member(dog_id));
create policy share_entries_read on public.share_link_entries for select using (exists (select 1 from public.share_links s where s.id = share_link_id and public.is_dog_member(s.dog_id)));
create policy jobs_read on public.generation_jobs for select using (public.is_dog_member(dog_id));
create policy credits_read on public.credit_ledger for select using (public.is_dog_member(dog_id));
create policy purchases_read on public.credit_purchases for select using (public.is_dog_member(dog_id));
create policy documents_read on public.documents for select using (public.is_dog_member(dog_id) and status <> 'deleted');
create policy documents_update on public.documents for update using (public.can_edit_dog(dog_id)) with check (public.can_edit_dog(dog_id));
create policy visit_documents_all on public.visit_documents for all
  using (exists (select 1 from public.visits v where v.id = visit_id and public.can_edit_dog(v.dog_id)))
  with check (exists (select 1 from public.visits v where v.id = visit_id and public.can_edit_dog(v.dog_id)));
create policy visit_documents_read on public.visit_documents for select using (exists (select 1 from public.visits v where v.id = visit_id and public.is_dog_member(v.dog_id)));
create policy daily_plans_read on public.daily_plans for select using (public.is_dog_member(dog_id));
create policy advances_read on public.collection_advances for select using (public.is_dog_member(dog_id));
create policy medals_read on public.medals for select using (public.is_dog_member(dog_id));

do $$
declare t text;
begin
  foreach t in array array['health_profiles', 'weights', 'vaccines', 'visits', 'medications', 'contacts'] loop
    execute format('create policy %1$s_read on public.%1$I for select using (public.is_dog_member(dog_id))', t);
    execute format('create policy %1$s_write on public.%1$I for all using (public.can_edit_dog(dog_id)) with check (public.can_edit_dog(dog_id))', t);
  end loop;
end $$;

-- ---------- Créditos por diário ----------
create or replace function public.credit_available_dog(p_dog uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case operation when 'grant' then amount when 'refund' then amount when 'reserve' then -amount when 'release' then amount else 0 end), 0)::int
  from credit_ledger where dog_id = p_dog
$$;

create or replace function public.reserve_credit_dog(p_dog uuid, p_owner uuid, p_job uuid, p_cost integer) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('credits:' || p_dog::text));
  if exists (select 1 from credit_ledger where idempotency_key = 'reserve:' || p_job) then return true; end if;
  if credit_available_dog(p_dog) < p_cost then return false; end if;
  insert into credit_ledger (owner_id, dog_id, job_id, operation, amount, idempotency_key) values (p_owner, p_dog, p_job, 'reserve', p_cost, 'reserve:' || p_job);
  return true;
end $$;

-- Consumo/liberação herdam o diário da reserva.
create or replace function public.settle_credit(p_job uuid, p_op text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.credit_ledger;
begin
  if p_op not in ('consume', 'release') then raise exception 'BAD_OP'; end if;
  select * into r from credit_ledger where idempotency_key = 'reserve:' || p_job;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtext('job:' || p_job::text));
  if exists (select 1 from credit_ledger where idempotency_key in ('consume:' || p_job, 'release:' || p_job)) then return false; end if;
  insert into credit_ledger (owner_id, dog_id, job_id, operation, amount, idempotency_key) values (r.owner_id, r.dog_id, p_job, p_op, r.amount, p_op || ':' || p_job);
  return true;
end $$;

-- 3 créditos de boas-vindas: uma vez por PESSOA, no primeiro diário que ela criar (chave antiga preservada).
create or replace function public.grant_welcome_credits(p_owner uuid, p_dog uuid, p_amount integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_amount <= 0 then return; end if;
  insert into credit_ledger (owner_id, dog_id, operation, amount, idempotency_key)
  values (p_owner, p_dog, 'grant', p_amount, 'grant:test:' || p_owner) on conflict (idempotency_key) do nothing;
end $$;

-- Arte do mês por diário: XP do mês do cachorro (fuso de Brasília), 1 crédito por diário e mês.
create or replace function public.monthly_xp_dog(p_dog uuid, p_month text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::int from xp_ledger
  where dog_id = p_dog and to_char(created_at at time zone 'America/Sao_Paulo', 'YYYY-MM') = p_month
$$;
create or replace function public.grant_monthly_xp_credit_dog(p_dog uuid, p_goal integer default 200, p_month text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare m text := coalesce(p_month, to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM')); o uuid;
begin
  if p_goal <= 0 or monthly_xp_dog(p_dog, m) < p_goal then return false; end if;
  select owner_id into o from dogs where id = p_dog;
  insert into credit_ledger (owner_id, dog_id, operation, amount, idempotency_key)
  values (o, p_dog, 'grant', 1, 'xp-month:dog:' || p_dog || ':' || m) on conflict (idempotency_key) do nothing;
  return found;
end $$;

-- Compra aprovada: créditos no diário da compra.
create or replace function public.grant_purchase_credits(p_purchase uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare p public.credit_purchases;
begin
  perform pg_advisory_xact_lock(hashtext('purchase:' || p_purchase::text));
  select * into p from credit_purchases where id = p_purchase;
  if not found or p.status <> 'approved' then return false; end if;
  insert into credit_ledger (owner_id, dog_id, operation, amount, payment_id, idempotency_key)
  values (p.owner_id, p.dog_id, 'grant', p.credits, p.provider || ':' || coalesce(p.provider_payment_id, p.id::text), 'purchase:' || p.id)
  on conflict (idempotency_key) do nothing;
  return found;
end $$;

revoke all on function public.credit_available_dog(uuid), public.reserve_credit_dog(uuid, uuid, uuid, integer), public.grant_welcome_credits(uuid, uuid, integer),
  public.monthly_xp_dog(uuid, text), public.grant_monthly_xp_credit_dog(uuid, integer, text), public.settle_credit(uuid, text), public.grant_purchase_credits(uuid)
  from public, anon, authenticated;

-- Conclusões de missão herdam o cachorro da instância (para os membros lerem).
create or replace function public.submission_dog() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.dog_id is null then select dog_id into new.dog_id from mission_instances where id = new.instance_id; end if;
  return new;
end $$;
drop trigger if exists submission_dog on public.mission_submissions;
create trigger submission_dog before insert on public.mission_submissions for each row execute function public.submission_dog();
