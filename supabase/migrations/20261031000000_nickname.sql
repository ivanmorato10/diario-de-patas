-- Apelido carinhoso do cachorro (opcional), mostrado no perfil.
alter table public.dogs add column if not exists nickname text check (nickname is null or char_length(nickname) <= 30);
