-- Diário de Patas — ajustes para o app em modo real (MUDANCAS-V2 §8).
-- Álbuns criados pela pessoa (type = 'custom', collection_id nulo) ganham data de criação para ordenar.
alter table public.albums add column if not exists created_at timestamptz not null default now();
-- Importar o diário do modo demonstração uma única vez (§8.2).
alter table public.profiles add column if not exists demo_imported_at timestamptz;
-- Lembrança importada guarda a chave original do aparelho (retry da importação não duplica).
create index if not exists entries_request_key on public.diary_entries (owner_id, request_key);
