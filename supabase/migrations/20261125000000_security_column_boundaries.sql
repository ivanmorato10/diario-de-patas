-- Revisão de segurança S02: o RLS confere a LINHA, não as colunas. Pela Data API (anon key + sessão), quem pode
-- editar um diário conseguia trocar dono, chaves de Storage, mídia/documento de outro diário e ligações entre
-- diários. Agora a pessoa só altera as colunas de conteúdo que o próprio app grava com a sessão dela; o resto
-- passa pelo servidor (service role). Ligações entre registros precisam ser do mesmo diário.

-- Visitante anônimo nunca escreve em nada.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon', t);
    execute format('revoke truncate on public.%I from authenticated', t);
  end loop;
end $$;

-- Perfil: nome, fuso e "demo importada" (o resto — créditos de boas-vindas, indicação, consentimento — só pelo servidor).
revoke insert, update, delete on public.profiles from authenticated;
grant insert (user_id, timezone, display_name) on public.profiles to authenticated;
grant update (display_name, timezone, demo_imported_at) on public.profiles to authenticated;

-- Cachorro: dono e id nunca mudam pela sessão.
revoke insert, update on public.dogs from authenticated;
grant insert (owner_id, name, nickname, birth_date, preferences_json) on public.dogs to authenticated;
grant update (name, nickname, birth_date, preferences_json, avatar_crop, photo_asset_id) on public.dogs to authenticated;

-- Lembrança: só legenda e data (mídia, origem, exclusão e dono, só pelo servidor).
revoke insert, update on public.diary_entries from authenticated;
grant update (caption, occurred_date) on public.diary_entries to authenticated;

-- Documento: só os dados descritivos (chaves de Storage, tipo, tamanho e status, só pelo servidor).
revoke insert, update on public.documents from authenticated;
grant update (title, category, doc_date, expires_on, notes, updated_at) on public.documents to authenticated;

-- Álbuns: o servidor cria; a sessão só renomeia (e apaga os personalizados).
revoke insert, update on public.albums from authenticated;
grant update (title) on public.albums to authenticated;
revoke update on public.album_entries, public.visit_documents from authenticated;

-- Cuidados: conteúdo editável; dono/diário fixos.
revoke update on public.vaccines, public.visits, public.medications, public.contacts, public.weights from authenticated;
grant update (kind, name, applied_date, next_date, clinic, document_id, updated_at) on public.vaccines to authenticated;
grant update (date, time, clinic, vet, reason, notes, next_date, updated_at) on public.visits to authenticated;
grant update (name, dose, frequency, repeat, last_given, start_date, end_date, notes, updated_at) on public.medications to authenticated;
grant update (kind, name, phone, address, notes, updated_at) on public.contacts to authenticated;
grant update (date, kg) on public.weights to authenticated;

-- Cartinhas: o servidor grava; pela sessão, só o texto e a data.
revoke insert, update on public.letters from authenticated;
grant update (body, letter_date, updated_at) on public.letters to authenticated;

-- Avisos: só marcar como lido.
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Ossinhos: o servidor grava (confere que o alvo é do diário).
revoke insert, update on public.bones from authenticated;

-- Ligações e donos coerentes, para escritas feitas com a sessão da pessoa (o servidor com service role não passa aqui).
-- Roda com os direitos de quem escreve: um id de outro diário nem é visível, e a escrita é recusada.
create or replace function public.guard_client_refs() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare ok boolean := true;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  case tg_table_name
    when 'dogs' then
      ok := new.photo_asset_id is null
        or (tg_op = 'UPDATE' and new.photo_asset_id is not distinct from old.photo_asset_id)
        or exists (select 1 from media_assets m where m.id = new.photo_asset_id and m.dog_id = new.id and m.status = 'ready');
    when 'album_entries' then
      ok := exists (select 1 from albums a join diary_entries e on e.dog_id = a.dog_id where a.id = new.album_id and e.id = new.entry_id);
    when 'visit_documents' then
      ok := exists (select 1 from visits v join documents d on d.dog_id = v.dog_id where v.id = new.visit_id and d.id = new.document_id);
    when 'health_profiles' then
      ok := (tg_op = 'INSERT' or (new.dog_id = old.dog_id and new.owner_id = old.owner_id))
        and exists (select 1 from dogs g where g.id = new.dog_id and g.owner_id = new.owner_id);
    else -- vaccines, visits, medications, contacts, weights
      ok := exists (select 1 from dogs g where g.id = new.dog_id and g.owner_id = new.owner_id);
      if ok and tg_table_name = 'vaccines' then
        if new.document_id is not null then
          ok := exists (select 1 from documents d where d.id = new.document_id and d.dog_id = new.dog_id);
        end if;
      end if;
  end case;
  if not ok then raise exception 'referência fora do diário' using errcode = '42501'; end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['dogs', 'album_entries', 'visit_documents', 'health_profiles', 'vaccines', 'visits', 'medications', 'contacts', 'weights'] loop
    execute format('drop trigger if exists guard_client_refs on public.%I', t);
    execute format('create trigger guard_client_refs before insert or update on public.%I for each row execute function public.guard_client_refs()', t);
  end loop;
end $$;
revoke all on function public.guard_client_refs() from public, anon, authenticated;
