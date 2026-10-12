-- Diário de Patas — esquema inicial (briefing §16).
-- STATUS: escrito, NÃO aplicado nem testado contra um projeto Supabase real (sem credenciais nesta etapa).
-- Princípios: UUIDs, RLS em tudo, bucket privado, regras de XP/créditos só no servidor.

create extension if not exists pgcrypto;

-- ---------- Perfis e cachorros ----------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  locale text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);

create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  photo_asset_id uuid,
  birth_date date,
  preferences_json jsonb not null default '{"home":true,"outdoor":true,"people":true,"socialDogs":false}',
  created_at timestamptz not null default now()
);
-- MVP: um cachorro por conta (modelo preparado para vários).
create unique index dogs_one_per_owner on public.dogs (owner_id);

-- ---------- Mídia ----------
create type public.media_kind as enum ('photo', 'art');
create type public.media_status as enum ('pending_upload', 'ready', 'deleted');

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  private_storage_key text not null unique, -- caminho no bucket privado; nunca exposto ao cliente
  thumb_storage_key text,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes integer not null check (bytes > 0 and bytes <= 10485760),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  hash text not null, -- reenvio exato dentro da conta; nunca comparado entre contas
  kind public.media_kind not null default 'photo',
  status public.media_status not null default 'pending_upload',
  created_at timestamptz not null default now()
);
create index media_owner_hash on public.media_assets (owner_id, hash);
alter table public.dogs add constraint dogs_photo_fk foreign key (photo_asset_id) references public.media_assets (id) on delete set null;

-- ---------- Diário ----------
create type public.entry_source as enum ('free', 'mission', 'studio');

create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  media_asset_id uuid not null references public.media_assets (id),
  caption text not null default '' check (char_length(caption) <= 280),
  occurred_date date not null, -- data civil: sem conversão para UTC
  timezone text not null,
  source public.entry_source not null default 'free',
  request_key uuid not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (owner_id, request_key)
);
create index entries_timeline on public.diary_entries (dog_id, occurred_date desc) where deleted_at is null;

-- ---------- Missões ----------
create table public.mission_templates (
  id text primary key, -- M01..M12
  slug text not null unique,
  localized_title jsonb not null,
  visual_criterion jsonb not null,
  xp integer not null check (xp > 0),
  collection_id text not null,
  eligibility text not null default 'any',
  prerequisite_id text references public.mission_templates (id),
  subjective boolean not null default false,
  version integer not null default 1,
  active boolean not null default true
);

create table public.mission_instances (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  template_id text not null references public.mission_templates (id),
  period_key text not null default 'once', -- 'once' = catálogo inicial; eventos futuros usam outra chave
  available_at timestamptz not null default now(),
  status text not null default 'available',
  unique (dog_id, template_id, period_key)
);

create table public.mission_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  instance_id uuid not null references public.mission_instances (id) on delete cascade,
  entry_id uuid references public.diary_entries (id) on delete set null,
  status text not null check (status in ('pending', 'approved', 'uncertain', 'not_matched', 'technical_failure')),
  reason_code text,
  provider_version text,
  request_key uuid not null,
  created_at timestamptz not null default now(),
  unique (owner_id, request_key)
);

create table public.mission_completions (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null unique references public.mission_instances (id) on delete cascade,
  accepted_submission_id uuid not null references public.mission_submissions (id),
  completed_at timestamptz not null default now()
);

create table public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  completion_id uuid not null unique references public.mission_completions (id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null,
  created_at timestamptz not null default now()
);

-- ---------- Álbuns ----------
create table public.albums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  collection_id text, -- álbuns iniciais ligados às coleções
  title text not null check (char_length(title) between 1 and 40),
  type text not null default 'collection',
  cover_asset_id uuid references public.media_assets (id) on delete set null,
  unique (dog_id, collection_id)
);

create table public.album_entries (
  album_id uuid not null references public.albums (id) on delete cascade,
  entry_id uuid not null references public.diary_entries (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (album_id, entry_id)
);

-- ---------- Compartilhamento ----------
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique, -- sha256 do token aleatório; o token nunca é armazenado
  title text not null check (char_length(title) <= 60),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz
);

create table public.share_link_entries (
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  entry_id uuid not null references public.diary_entries (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (share_link_id, entry_id)
);

-- ---------- Estúdio e créditos ----------
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  input_asset_id uuid references public.media_assets (id) on delete set null,
  theme_id text not null check (theme_id in ('aniversario', 'halloween', 'natal')),
  state text not null default 'queued' check (state in ('queued', 'processing', 'succeeded', 'failed', 'cancelled')),
  provider_job_id text,
  output_asset_id uuid references public.media_assets (id) on delete set null,
  idempotency_key uuid not null,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid references public.generation_jobs (id) on delete set null,
  payment_id text,
  operation text not null check (operation in ('grant', 'reserve', 'consume', 'release', 'refund')),
  amount integer not null check (amount > 0),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.usage_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  day_bucket date not null,
  cost_units numeric,
  request_id text,
  created_at timestamptz not null default now()
);
create index usage_by_day on public.usage_events (owner_id, type, day_bucket);

-- ---------- RLS ----------
-- Leitura do dono; escritas sensíveis (XP, créditos, conclusões, submissões, jobs, links) só via servidor (service role ou funções abaixo).
alter table public.profiles enable row level security;
alter table public.dogs enable row level security;
alter table public.media_assets enable row level security;
alter table public.diary_entries enable row level security;
alter table public.mission_templates enable row level security;
alter table public.mission_instances enable row level security;
alter table public.mission_submissions enable row level security;
alter table public.mission_completions enable row level security;
alter table public.xp_ledger enable row level security;
alter table public.albums enable row level security;
alter table public.album_entries enable row level security;
alter table public.share_links enable row level security;
alter table public.share_link_entries enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.usage_events enable row level security;

create policy own_profile on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_dogs on public.dogs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own_media_read on public.media_assets for select using (owner_id = auth.uid());
create policy own_entries_read on public.diary_entries for select using (owner_id = auth.uid() and deleted_at is null);
create policy own_entries_update on public.diary_entries for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy templates_read on public.mission_templates for select using (active);
create policy own_instances_read on public.mission_instances for select using (exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid()));
create policy own_submissions_read on public.mission_submissions for select using (owner_id = auth.uid());
create policy own_completions_read on public.mission_completions for select using (exists (
  select 1 from public.mission_instances i join public.dogs d on d.id = i.dog_id where i.id = instance_id and d.owner_id = auth.uid()));
create policy own_xp_read on public.xp_ledger for select using (exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid()));
create policy own_albums on public.albums for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own_album_entries on public.album_entries for all
  using (exists (select 1 from public.albums a where a.id = album_id and a.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.albums a where a.id = album_id and a.owner_id = auth.uid())
    and exists (select 1 from public.diary_entries e where e.id = entry_id and e.owner_id = auth.uid()));
create policy own_shares_read on public.share_links for select using (owner_id = auth.uid());
create policy own_share_entries_read on public.share_link_entries for select using (exists (select 1 from public.share_links s where s.id = share_link_id and s.owner_id = auth.uid()));
create policy own_jobs_read on public.generation_jobs for select using (owner_id = auth.uid());
create policy own_credits_read on public.credit_ledger for select using (owner_id = auth.uid());
-- usage_events: sem política para clientes (somente servidor).

-- ---------- Conclusão de missão idempotente ----------
-- Chamada pelo servidor DEPOIS de validar a saída da IA. Concorrência resolvida por unique(instance_id) e unique(completion_id).
create or replace function public.complete_mission(p_submission_id uuid)
returns table (completion_id uuid, xp_awarded integer, already_completed boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_sub public.mission_submissions;
  v_inst public.mission_instances;
  v_xp integer;
  v_completion uuid;
  v_inserted integer;
begin
  select * into v_sub from mission_submissions where id = p_submission_id and status = 'approved';
  if not found then raise exception 'SUBMISSION_NOT_APPROVED'; end if;
  select * into v_inst from mission_instances where id = v_sub.instance_id;
  select xp into v_xp from mission_templates where id = v_inst.template_id;

  insert into mission_completions (instance_id, accepted_submission_id)
  values (v_inst.id, v_sub.id)
  on conflict (instance_id) do nothing
  returning id into v_completion;

  if v_completion is null then
    select id into v_completion from mission_completions where instance_id = v_inst.id;
    return query select v_completion, 0, true;
    return;
  end if;

  insert into xp_ledger (dog_id, completion_id, amount, reason)
  values (v_inst.dog_id, v_completion, v_xp, 'mission:' || v_inst.template_id)
  on conflict (completion_id) do nothing;
  get diagnostics v_inserted = row_count;
  return query select v_completion, case when v_inserted > 0 then v_xp else 0 end, false;
end $$;
revoke all on function public.complete_mission(uuid) from public, anon, authenticated;

-- ---------- Créditos: reserva atômica sem saldo negativo ----------
-- disponível = concedido + estornado − reservado + liberado.
-- "consume" não altera o disponível: só move a reserva para consumida (paridade com src/domain/credits.ts).
create or replace function public.credit_available(p_owner uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case operation
    when 'grant' then amount when 'refund' then amount
    when 'reserve' then -amount when 'release' then amount
    else 0 end), 0)::int
  from credit_ledger where owner_id = p_owner
$$;

create or replace function public.reserve_credit(p_owner uuid, p_job uuid, p_cost integer) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_owner::text)); -- serializa reservas da mesma conta
  if exists (select 1 from credit_ledger where idempotency_key = 'reserve:' || p_job) then return true; end if;
  if public.credit_available(p_owner) < p_cost then return false; end if;
  insert into credit_ledger (owner_id, job_id, operation, amount, idempotency_key)
  values (p_owner, p_job, 'reserve', p_cost, 'reserve:' || p_job);
  return true;
end $$;
revoke all on function public.reserve_credit(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.credit_available(uuid) from public, anon, authenticated;

-- ---------- Storage ----------
-- Bucket privado; acesso a objetos só pelo servidor (URLs assinadas curtas ou proxy que revalida dono/link).
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;
