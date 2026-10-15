-- Avisos da família ("Novidades" no sininho e push no celular).
-- * notifications: um aviso por pessoa que recebe. Fotos em sequência da mesma pessoa viram um aviso só
--   (count soma), para não lotar o celular.
-- * push_subscriptions: os aparelhos de cada pessoa que aceitaram receber avisos.
-- * profiles.notify_*: a pessoa escolhe quais avisos quer (foto, cartinha, ossinho).
-- Tudo é escrito pelo servidor; cada pessoa só lê (e marca como lido) os próprios avisos.

alter table public.profiles add column if not exists notify_photo boolean not null default true;
alter table public.profiles add column if not exists notify_letter boolean not null default true;
alter table public.profiles add column if not exists notify_bone boolean not null default true;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('photo', 'letter', 'bone')),
  target_type text check (target_type in ('entry', 'letter')),
  target_id uuid,
  count integer not null default 1 check (count >= 1),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_recent on public.notifications (user_id, created_at desc);
create index if not exists notifications_group on public.notifications (user_id, dog_id, actor_id, kind) where read_at is null;
alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select using (user_id = auth.uid());
create policy notifications_mark on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_read on public.push_subscriptions for select using (user_id = auth.uid());

-- Avisos de uma lembrança ou cartinha apagada somem junto.
create or replace function public.notifications_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from notifications where target_id = old.id and target_type = tg_argv[0];
  return old;
end $$;
drop trigger if exists letters_notifications_cleanup on public.letters;
create trigger letters_notifications_cleanup after delete on public.letters for each row execute function public.notifications_cleanup('letter');
drop trigger if exists entries_notifications_cleanup on public.diary_entries;
create trigger entries_notifications_cleanup after delete on public.diary_entries for each row execute function public.notifications_cleanup('entry');
