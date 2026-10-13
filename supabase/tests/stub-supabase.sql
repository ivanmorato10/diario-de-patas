-- Stub mínimo do Supabase (papéis, auth.users, auth.uid(), storage) para testar migrations num Postgres comum.
-- NÃO usar no Supabase de verdade: lá estes objetos já existem.
do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; end if; end $$;
create schema auth; create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
create schema storage; create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
grant usage on schema public to anon, authenticated;
-- Como no Supabase: anon e authenticated recebem acesso às tabelas; quem protege é a RLS.
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
