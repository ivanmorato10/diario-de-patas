-- Família: nomes e emails de quem participa do diário numa consulta só (antes, uma chamada ao serviço de login por
-- pessoa, a cada carregamento) — 23/10/2026. Só o servidor (service_role) pode chamar.
create or replace function public.member_accounts(p_ids uuid[])
returns table (id uuid, email text, meta jsonb)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.email::text, coalesce(u.raw_user_meta_data, '{}'::jsonb) from auth.users u where u.id = any(p_ids)
$$;
revoke all on function public.member_accounts(uuid[]) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on function public.member_accounts(uuid[]) from anon, authenticated'; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant execute on function public.member_accounts(uuid[]) to service_role'; end if;
end $$;
