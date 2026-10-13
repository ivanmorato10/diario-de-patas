-- Diário de Patas — ciclo contínuo de missões (MUDANCAS-V2 §7).
-- STATUS: escrito, NÃO aplicado no Supabase.
-- mission_instances.period_key: 'once' (únicas e itens de coleção), 'AAAA-MM-DD' (missão do dia), 'AAAA' (especial).

alter table public.mission_templates
  add column kind text not null default 'once' check (kind in ('once', 'daily', 'collection_item', 'special')),
  add column slot text check (slot in ('A', 'B', 'C')),
  add column portrait boolean not null default false,
  add column advances_item text references public.mission_templates (id),
  add column studio_theme text check (studio_theme in ('aniversario', 'halloween', 'natal')),
  add constraint daily_has_slot check (kind <> 'daily' or slot is not null);

-- Plano do dia: gravado na primeira abertura do dia, no fuso do usuário (§7.1).
create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  plan_date date not null, -- data civil no fuso do usuário
  slots jsonb not null, -- {"A":"D01","B":"D13","C":"D25"}
  swaps jsonb not null default '{"A":0,"B":0,"C":0}',
  shown jsonb not null, -- tudo o que já apareceu hoje por espaço
  created_at timestamptz not null default now(),
  unique (dog_id, plan_date)
);

-- Item de coleção avançado por uma missão do dia, sem XP extra.
create table public.collection_advances (
  dog_id uuid not null references public.dogs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null references public.mission_templates (id),
  entry_id uuid references public.diary_entries (id) on delete set null,
  via_mission_id text not null references public.mission_templates (id),
  created_at timestamptz not null default now(),
  primary key (dog_id, item_id)
);

create table public.medals (
  dog_id uuid not null references public.dogs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  set_id text not null check (set_id in ('poses-de-dormir', 'caras-e-expressoes', 'nossos-passeios', 'nos-dois', 'brinquedos-e-manias')),
  created_at timestamptz not null default now(),
  primary key (dog_id, set_id)
);

-- XP de medalha não vem de uma conclusão de missão: o ledger aceita uma das duas origens, cada uma única.
alter table public.xp_ledger alter column completion_id drop not null;
alter table public.xp_ledger add column medal_key text unique;
alter table public.xp_ledger add constraint xp_one_source check ((completion_id is null) <> (medal_key is null));

-- Medalha + 50 XP uma única vez, mesmo com requisições simultâneas (chave primária + medal_key único + lock).
create or replace function public.award_medal(p_dog uuid, p_owner uuid, p_set text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_inserted integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_dog::text || ':' || p_set));
  insert into medals (dog_id, owner_id, set_id) values (p_dog, p_owner, p_set) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;
  insert into xp_ledger (dog_id, medal_key, amount, reason) values (p_dog, p_dog::text || ':' || p_set, 50, 'medal:' || p_set);
  return true;
end $$;
revoke all on function public.award_medal(uuid, uuid, text) from public, anon, authenticated;

alter table public.daily_plans enable row level security;
alter table public.collection_advances enable row level security;
alter table public.medals enable row level security;
-- Leitura pelo dono; escrita só pelo servidor (sorteio, troca, conclusão e medalhas são regras do servidor).
create policy own_daily_plans_read on public.daily_plans for select using (owner_id = auth.uid());
create policy own_collection_advances_read on public.collection_advances for select using (owner_id = auth.uid());
create policy own_medals_read on public.medals for select using (owner_id = auth.uid());
