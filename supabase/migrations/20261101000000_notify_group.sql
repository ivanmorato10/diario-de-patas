-- Aviso de fotos agrupado sem corrida: várias fotos enviadas ao mesmo tempo pela mesma pessoa viram
-- UM aviso com o total. A trava (advisory lock por destinatário+cachorro+autor) garante que dois envios
-- simultâneos não criem dois avisos nem percam a contagem.
create or replace function public.bump_photo_notice(p_user uuid, p_dog uuid, p_actor uuid, p_target uuid, p_window interval default interval '2 hours')
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform pg_advisory_xact_lock(hashtext('photo-notice:' || p_user || ':' || p_dog || ':' || p_actor));
  update notifications set count = count + 1, created_at = now(), target_id = p_target
    where id = (
      select id from notifications
      where user_id = p_user and dog_id = p_dog and actor_id = p_actor and kind = 'photo'
        and read_at is null and created_at >= now() - p_window
      order by created_at desc limit 1
    )
    returning count into n;
  if n is null then
    insert into notifications (user_id, dog_id, actor_id, kind, target_type, target_id) values (p_user, p_dog, p_actor, 'photo', 'entry', p_target);
    n := 1;
  end if;
  return n;
end $$;
revoke all on function public.bump_photo_notice(uuid, uuid, uuid, uuid, interval) from public, anon, authenticated;
