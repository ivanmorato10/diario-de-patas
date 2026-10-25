-- Estúdio: conclusão da arte numa transação só — 24/10/2026.
-- Antes, a mídia, a lembrança, o álbum, o consumo do crédito e o "concluída" eram gravados em passos separados; uma
-- falha depois do consumo (ex.: registro de uso) marcava a arte entregue como falha, sem devolver o crédito.
-- Agora: ou tudo acontece (arte no Diário + crédito consumido uma vez + job concluído), ou nada (o job pode falhar e
-- a reserva volta). Repetir a conclusão devolve a mesma lembrança, sem duplicar arte, álbum nem consumo.
create or replace function public.finalize_studio_job(p_job uuid, p_media jsonb, p_entry jsonb, p_album uuid, p_provider text)
returns uuid language plpgsql security definer set search_path = public as $$
declare j public.generation_jobs; e uuid; m uuid := (p_media ->> 'id')::uuid;
begin
  perform pg_advisory_xact_lock(hashtext('job:' || p_job::text));
  select * into j from generation_jobs where id = p_job for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.state = 'succeeded' then return j.output_entry_id; end if; -- repetição: já concluída
  if j.state <> 'processing' then raise exception 'JOB_NOT_PROCESSING'; end if;
  insert into media_assets (id, owner_id, dog_id, private_storage_key, thumb_storage_key, mime, bytes, width, height, hash, kind, status)
    values (m, j.owner_id, j.dog_id, p_media ->> 'private_storage_key', p_media ->> 'thumb_storage_key', 'image/webp',
            (p_media ->> 'bytes')::integer, (p_media ->> 'width')::integer, (p_media ->> 'height')::integer, p_media ->> 'hash', 'art', 'ready')
    on conflict (id) do nothing;
  insert into diary_entries (owner_id, created_by, dog_id, media_asset_id, caption, occurred_date, timezone, source, request_key)
    values (j.owner_id, j.requested_by, j.dog_id, m, coalesce(p_entry ->> 'caption', ''), (p_entry ->> 'occurred_date')::date, p_entry ->> 'timezone', 'studio', p_job)
    on conflict (owner_id, request_key) do update set request_key = excluded.request_key
    returning id into e;
  insert into album_entries (album_id, entry_id) values (p_album, e) on conflict (album_id, entry_id) do nothing;
  perform settle_credit(p_job, 'consume');
  update generation_jobs set state = 'succeeded', output_asset_id = m, output_entry_id = e, provider_job_id = p_provider,
    finished_at = now(), updated_at = now() where id = p_job;
  return e;
end $$;
revoke all on function public.finalize_studio_job(uuid, jsonb, jsonb, uuid, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on function public.finalize_studio_job(uuid, jsonb, jsonb, uuid, text) from anon, authenticated'; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant execute on function public.finalize_studio_job(uuid, jsonb, jsonb, uuid, text) to service_role'; end if;
end $$;
