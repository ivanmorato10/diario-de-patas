-- Integridade antes do lançamento (relatório de 17/10/2026).

-- 17) Boas-vindas uma vez por CONTA. A prova ficava só no histórico de créditos, que some em cascata
--     quando o diário é apagado; agora fica no perfil.
alter table public.profiles add column if not exists welcome_credits_at timestamptz;
update public.profiles p set welcome_credits_at = coalesce(p.welcome_credits_at, now())
  where exists (select 1 from public.credit_ledger c where c.idempotency_key = 'grant:test:' || p.user_id);

create or replace function public.grant_welcome_credits(p_owner uuid, p_dog uuid, p_amount integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_amount <= 0 then return; end if;
  perform pg_advisory_xact_lock(hashtext('welcome:' || p_owner));
  insert into profiles (user_id) values (p_owner) on conflict (user_id) do nothing;
  if (select welcome_credits_at from profiles where user_id = p_owner) is not null then return; end if;
  insert into credit_ledger (owner_id, dog_id, operation, amount, idempotency_key)
    values (p_owner, p_dog, 'grant', p_amount, 'welcome:' || p_owner || ':' || p_dog) on conflict (idempotency_key) do nothing;
  update profiles set welcome_credits_at = now() where user_id = p_owner;
end $$;

-- 18) Créditos são do diário, não de quem comprou: excluir a conta de quem comprou não apaga créditos
--     nem compras do diário compartilhado (owner_id vira nulo e o histórico fica).
alter table public.credit_ledger alter column owner_id drop not null;
alter table public.credit_ledger drop constraint if exists credit_ledger_owner_id_fkey;
alter table public.credit_ledger add constraint credit_ledger_owner_id_fkey foreign key (owner_id) references auth.users (id) on delete set null;
alter table public.credit_purchases alter column owner_id drop not null;
alter table public.credit_purchases drop constraint if exists credit_purchases_owner_id_fkey;
alter table public.credit_purchases add constraint credit_purchases_owner_id_fkey foreign key (owner_id) references auth.users (id) on delete set null;
-- Lançamentos de compra passam a apontar para o dono do diário.
update public.credit_ledger c set owner_id = d.owner_id from public.dogs d
  where c.dog_id = d.id and c.idempotency_key like 'purchase:%' and c.owner_id is distinct from d.owner_id;

create or replace function public.grant_purchase_credits(p_purchase uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare p public.credit_purchases; o uuid;
begin
  perform pg_advisory_xact_lock(hashtext('purchase:' || p_purchase::text));
  select * into p from credit_purchases where id = p_purchase;
  if not found or p.status <> 'approved' then return false; end if;
  select owner_id into o from dogs where id = p.dog_id;
  insert into credit_ledger (owner_id, dog_id, operation, amount, payment_id, idempotency_key)
  values (o, p.dog_id, 'grant', p.credits, p.provider || ':' || coalesce(p.provider_payment_id, p.id::text), 'purchase:' || p.id)
  on conflict (idempotency_key) do nothing;
  return found;
end $$;

-- Operação própria para estorno ("revoke"), que desconta do saldo.
alter table public.credit_ledger drop constraint if exists credit_ledger_operation_check;
alter table public.credit_ledger add constraint credit_ledger_operation_check check (operation in ('grant', 'reserve', 'consume', 'release', 'refund', 'revoke'));
create or replace function public.credit_available_dog(p_dog uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case operation when 'grant' then amount when 'refund' then amount when 'reserve' then -amount when 'release' then amount when 'revoke' then -amount else 0 end), 0)::int
  from credit_ledger where dog_id = p_dog
$$;

-- 16) Estorno/chargeback depois de aprovado: tira do saldo só o que ainda não foi usado (nunca fica negativo).
--     Devolve quantos créditos foram retirados. A política para créditos já usados é decisão do proprietário.
create or replace function public.revoke_purchase_credits(p_purchase uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare p public.credit_purchases; avail integer; take integer; o uuid;
begin
  perform pg_advisory_xact_lock(hashtext('purchase:' || p_purchase::text));
  select * into p from credit_purchases where id = p_purchase;
  if not found or p.dog_id is null then return 0; end if;
  if not exists (select 1 from credit_ledger where idempotency_key = 'purchase:' || p.id) then return 0; end if;
  if exists (select 1 from credit_ledger where idempotency_key = 'purchase-refund:' || p.id) then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('credits:' || p.dog_id::text));
  avail := credit_available_dog(p.dog_id);
  take := greatest(0, least(p.credits, avail));
  select owner_id into o from dogs where id = p.dog_id;
  if take = 0 then return 0; end if; -- tudo já usado: nada a retirar (a compra fica "refunded")
  insert into credit_ledger (owner_id, dog_id, operation, amount, payment_id, idempotency_key)
    values (o, p.dog_id, 'revoke', take, p.provider || ':' || coalesce(p.provider_payment_id, p.id::text), 'purchase-refund:' || p.id);
  return take;
end $$;

-- 21) Aceitar convite numa transação: uso único sob concorrência e acesso garantido antes do "sucesso".
create or replace function public.accept_invite(p_code_hash text, p_user uuid, p_name text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.dog_invites;
begin
  select * into inv from dog_invites where code_hash = p_code_hash for update;
  if not found or inv.expires_at < now() then raise exception 'INVALID_CODE'; end if;
  if inv.used_at is not null and inv.used_by is distinct from p_user then raise exception 'INVALID_CODE'; end if;
  insert into dog_members (dog_id, user_id, role, invited_by) values (inv.dog_id, p_user, inv.role, inv.created_by)
    on conflict (dog_id, user_id) do nothing;
  update dog_invites set used_at = coalesce(used_at, now()), used_by = p_user where id = inv.id;
  insert into profiles (user_id, current_dog_id) values (p_user, inv.dog_id)
    on conflict (user_id) do update set current_dog_id = excluded.current_dog_id;
  if nullif(btrim(coalesce(p_name, '')), '') is not null then
    update profiles set display_name = left(regexp_replace(btrim(p_name), '\s+', ' ', 'g'), 40), name_confirmed = true where user_id = p_user;
  end if;
  return inv.dog_id;
end $$;

-- 24) Limite de lembranças garantido no banco (com trava por diário): duas gravações ao mesmo tempo
--     não passam do limite. O servidor já confere antes; isto é a rede de segurança.
create table if not exists public.app_limits (key text primary key, value integer not null);
insert into public.app_limits (key, value) values ('max_entries', 100) on conflict (key) do nothing;
alter table public.app_limits enable row level security; -- sem política: só o servidor

create or replace function public.enforce_entry_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim integer; n integer;
begin
  perform pg_advisory_xact_lock(hashtext('entries:' || new.dog_id));
  select value into lim from app_limits where key = 'max_entries';
  select count(*) into n from diary_entries where dog_id = new.dog_id and deleted_at is null;
  if n >= coalesce(lim, 100) then raise exception 'STORAGE_QUOTA' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists diary_entries_limit on public.diary_entries;
create trigger diary_entries_limit before insert on public.diary_entries for each row execute function public.enforce_entry_limit();

-- 11) Artes: quem pediu (autoria e aviso para a família) e aviso do tipo "arte".
alter table public.generation_jobs add column if not exists requested_by uuid references auth.users (id) on delete set null;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('photo', 'letter', 'bone', 'art'));

-- 10) Álbum "Artes do Estúdio": um por cachorro (system_key evita duplicar em gerações simultâneas).
alter table public.albums add column if not exists system_key text;
create unique index if not exists albums_system_key on public.albums (dog_id, system_key) where system_key is not null;
insert into public.albums (owner_id, dog_id, title, type, system_key)
  select distinct d.owner_id, d.id, 'Artes do Estúdio', 'custom', 'studio'
  from public.dogs d join public.diary_entries e on e.dog_id = d.id and e.source = 'studio' and e.deleted_at is null
  on conflict do nothing;
insert into public.album_entries (album_id, entry_id)
  select a.id, e.id from public.albums a join public.diary_entries e on e.dog_id = a.dog_id and e.source = 'studio' and e.deleted_at is null
  where a.system_key = 'studio'
  on conflict do nothing;

revoke all on function public.grant_welcome_credits(uuid, uuid, integer), public.grant_purchase_credits(uuid), public.revoke_purchase_credits(uuid),
  public.accept_invite(text, uuid, text) from public, anon, authenticated;

-- 20) Fila de limpeza: tentativas e último erro (só marca como feito quando o armazenamento confirma).
alter table public.storage_cleanup add column if not exists attempts integer not null default 0;
alter table public.storage_cleanup add column if not exists last_error text;
