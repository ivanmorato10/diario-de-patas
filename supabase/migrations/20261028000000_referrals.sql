-- Indicar o app: cada pessoa tem um link próprio (?ref=CODIGO). Quando quem chegou pelo link cria o
-- diário do próprio cachorro E guarda a primeira foto, o cachorro de quem indicou ganha patinhas.
-- Regras contra abuso: só conta conta nova, nunca a própria pessoa, uma vez por pessoa indicada e
-- no máximo p_cap recompensas por mês para quem indica (fuso de Brasília).

alter table public.profiles add column if not exists referral_code text unique
  check (referral_code is null or referral_code ~ '^[A-Z2-9]{6}$');

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referred_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  rewarded_dog_id uuid references public.dogs (id) on delete set null,
  xp_amount integer not null default 0,
  check (referrer_id <> referred_id)
);
create index if not exists referrals_referrer on public.referrals (referrer_id);
alter table public.referrals enable row level security;
-- Quem indicou vê as próprias indicações (só contagem na tela); escrita só pelo servidor.
create policy referrals_read on public.referrals for select using (referrer_id = auth.uid());

-- Patinhas que não vêm de missão nem de medalha: chave única de origem.
alter table public.xp_ledger add column if not exists source_key text unique;
-- Exatamente uma origem por linha: missão, medalha ou outra (indicação).
alter table public.xp_ledger drop constraint if exists xp_one_source;
alter table public.xp_ledger add constraint xp_one_source check (
  (completion_id is not null)::int + (medal_key is not null)::int + (source_key is not null)::int = 1);

-- Confirma a indicação de p_referred (chamado quando a pessoa guarda uma foto no próprio diário).
-- Devolve o cachorro de quem indicou que recebeu as patinhas, ou null.
create or replace function public.confirm_referral(p_referred uuid, p_amount integer default 20, p_cap integer default 5)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r public.referrals;
  d uuid;
  m text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');
  n integer;
begin
  select * into r from referrals where referred_id = p_referred and confirmed_at is null for update;
  if not found then return null; end if;
  -- A pessoa indicada precisa ter um diário que ela mesma criou, com pelo menos uma foto.
  if not exists (
    select 1 from diary_entries e join dogs g on g.id = e.dog_id
    where g.owner_id = p_referred and e.deleted_at is null
  ) then return null; end if;
  update referrals set confirmed_at = now() where id = r.id;
  -- Diário de quem indicou: o aberto agora (se ainda participa), senão o primeiro que administra.
  select p.current_dog_id into d from profiles p
    join dog_members dm on dm.dog_id = p.current_dog_id and dm.user_id = p.user_id
    where p.user_id = r.referrer_id;
  if d is null then
    select dog_id into d from dog_members where user_id = r.referrer_id and role = 'admin' order by created_at limit 1;
  end if;
  if d is null then return null; end if;
  select count(*) into n from referrals
    where referrer_id = r.referrer_id and xp_amount > 0
      and to_char(confirmed_at at time zone 'America/Sao_Paulo', 'YYYY-MM') = m;
  if n >= p_cap then return null; end if;
  insert into xp_ledger (dog_id, completion_id, amount, reason, source_key)
    values (d, null, p_amount, 'referral', 'referral:' || p_referred)
    on conflict (source_key) do nothing;
  if not found then return null; end if;
  update referrals set rewarded_dog_id = d, xp_amount = p_amount where id = r.id;
  return d;
end $$;

revoke all on function public.confirm_referral(uuid, integer, integer) from public, anon, authenticated;
