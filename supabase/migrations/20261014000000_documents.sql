-- Diário de Patas — documentos importantes (MUDANCAS-V2 §5).
-- STATUS: escrito, NÃO aplicado no Supabase.
-- Arquivos no bucket PRIVADO separado `documents`, acesso só do dono (via servidor: URL assinada curta
-- ou rota que revalida o dono). Documentos nunca entram no Diário, nos Álbuns ou em compartilhamentos.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  category text not null check (category in ('vaccination_card', 'id_chip', 'pedigree', 'exams', 'prescriptions', 'insurance', 'adoption', 'other')),
  doc_date date,
  expires_on date check (expires_on is null or doc_date is null or expires_on >= doc_date),
  notes text not null default '' check (char_length(notes) <= 500),
  private_storage_key text not null unique, -- nunca exposto ao cliente
  thumb_storage_key text,
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  bytes integer not null check (bytes > 0 and bytes <= 10485760),
  status text not null default 'pending_upload' check (status in ('pending_upload', 'ready', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_by_dog on public.documents (dog_id, created_at desc);
create index documents_expiring on public.documents (owner_id, expires_on) where expires_on is not null;

-- Limite de teste: 50 documentos por cachorro (o servidor confere antes de criar o upload).
create or replace function public.documents_quota() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.documents where dog_id = new.dog_id and status <> 'deleted') >= 50 then
    raise exception 'DOC_QUOTA';
  end if;
  return new;
end $$;
create trigger documents_quota before insert on public.documents for each row execute function public.documents_quota();

alter table public.vaccines add constraint vaccines_document_fk foreign key (document_id) references public.documents (id) on delete set null;

create table public.visit_documents (
  visit_id uuid not null references public.visits (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  primary key (visit_id, document_id)
);

alter table public.documents enable row level security;
alter table public.visit_documents enable row level security;
-- Leitura e edição de metadados pelo dono; criação/exclusão do arquivo passa pelo servidor.
create policy own_documents_read on public.documents for select using (owner_id = auth.uid() and status <> 'deleted');
create policy own_documents_update on public.documents for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own_visit_documents on public.visit_documents for all
  using (exists (select 1 from public.visits v where v.id = visit_id and v.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.visits v where v.id = visit_id and v.owner_id = auth.uid())
    and exists (select 1 from public.documents d where d.id = document_id and d.owner_id = auth.uid())
  );

insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
