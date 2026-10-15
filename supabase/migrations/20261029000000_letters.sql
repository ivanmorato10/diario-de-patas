-- Cartinhas, ossinhos e o nome de quem usa.
-- * profiles.name_confirmed: a pessoa confirmou "Como a família te chama?" (antes o nome era um palpite).
-- * letters: texto para o cachorro, com data; aparece no Diário. Quem participa lê; quem pode editar
--   escreve; só quem escreveu (ou o administrador) altera ou apaga.
-- * bones: "ossinho" (o curtir do app) em fotos e cartinhas de outras pessoas da família.

alter table public.profiles add column if not exists name_confirmed boolean not null default false;

create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  letter_date date not null,
  request_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dog_id, request_key)
);
create index if not exists letters_dog_date on public.letters (dog_id, letter_date desc);
alter table public.letters enable row level security;
create policy letters_read on public.letters for select using (public.is_dog_member(dog_id));
create policy letters_insert on public.letters for insert with check (public.can_edit_dog(dog_id) and created_by = auth.uid());
create policy letters_update on public.letters for update
  using (public.can_edit_dog(dog_id) and (created_by = auth.uid() or public.dog_role(dog_id) = 'admin'))
  with check (public.can_edit_dog(dog_id));
create policy letters_delete on public.letters for delete
  using (public.can_edit_dog(dog_id) and (created_by = auth.uid() or public.dog_role(dog_id) = 'admin'));

create table if not exists public.bones (
  dog_id uuid not null references public.dogs (id) on delete cascade,
  target_type text not null check (target_type in ('entry', 'letter')),
  target_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (target_type, target_id, user_id)
);
create index if not exists bones_dog on public.bones (dog_id);
alter table public.bones enable row level security;
-- Qualquer pessoa da família (inclusive "só ver") dá e tira o próprio ossinho.
create policy bones_read on public.bones for select using (public.is_dog_member(dog_id));
create policy bones_insert on public.bones for insert with check (public.is_dog_member(dog_id) and user_id = auth.uid());
create policy bones_delete on public.bones for delete using (user_id = auth.uid());

-- Ossinhos somem junto com a lembrança ou a cartinha.
create or replace function public.bones_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from bones where target_id = old.id and target_type = tg_argv[0];
  return old;
end $$;
drop trigger if exists letters_bones_cleanup on public.letters;
create trigger letters_bones_cleanup after delete on public.letters for each row execute function public.bones_cleanup('letter');
drop trigger if exists entries_bones_cleanup on public.diary_entries;
create trigger entries_bones_cleanup after delete on public.diary_entries for each row execute function public.bones_cleanup('entry');
