-- Diário de Patas — ficha de cuidados (MUDANCAS-V2 §4).
-- STATUS: escrito, NÃO aplicado nem testado contra um projeto Supabase real.
-- Registro do dono, sem função veterinária. Dados de saúde NUNCA entram em links
-- compartilhados, analytics ou Open Graph: nenhuma view/política pública lê estas tabelas.

create table public.health_profiles (
  dog_id uuid primary key references public.dogs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  breed text not null default '' check (char_length(breed) <= 60),
  sex text check (sex in ('female', 'male')),
  neutered boolean,
  microchip text not null default '' check (char_length(microchip) <= 40),
  coat text not null default '' check (char_length(coat) <= 60),
  allergies text not null default '' check (char_length(allergies) <= 500),
  notes text not null default '' check (char_length(notes) <= 1000),
  updated_at timestamptz not null default now()
);

create table public.weights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  date date not null, -- data civil
  kg numeric(5, 2) not null check (kg > 0 and kg <= 150),
  created_at timestamptz not null default now()
);
create index weights_by_dog on public.weights (dog_id, date);

create table public.vaccines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  kind text not null check (kind in ('vaccine', 'dewormer', 'antiflea', 'other')),
  name text not null check (char_length(name) between 1 and 80),
  applied_date date not null,
  next_date date check (next_date is null or next_date >= applied_date),
  clinic text not null default '' check (char_length(clinic) <= 120),
  document_id uuid, -- FK adicionada na migration de documentos (§5)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vaccines_by_dog on public.vaccines (dog_id, applied_date desc);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  date date not null,
  clinic text not null default '' check (char_length(clinic) <= 120),
  vet text not null default '' check (char_length(vet) <= 120),
  reason text not null default '' check (char_length(reason) <= 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  next_date date check (next_date is null or next_date >= date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visits_by_dog on public.visits (dog_id, date desc);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  dose text not null default '' check (char_length(dose) <= 80),
  frequency text not null default '' check (char_length(frequency) <= 80),
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  kind text not null check (kind in ('vet', 'clinic', 'emergency', 'sitter', 'other')),
  name text not null check (char_length(name) between 1 and 80),
  phone text not null default '' check (char_length(phone) <= 30),
  address text not null default '' check (char_length(address) <= 200),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: só o dono lê e escreve. O dog_id precisa ser de um cachorro do próprio dono.
do $$
declare t text;
begin
  foreach t in array array['health_profiles', 'weights', 'vaccines', 'visits', 'medications', 'contacts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy own_%1$s on public.%1$I for all
         using (owner_id = auth.uid())
         with check (owner_id = auth.uid() and exists (select 1 from public.dogs d where d.id = dog_id and d.owner_id = auth.uid()))',
      t);
  end loop;
end $$;
