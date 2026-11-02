-- Revisão de segurança S04: pedidos de envio (URL assinada do Storage) com limite por pessoa. Antes, uma conta
-- podia pedir envios sem fim (registros pendentes e arquivos de até 10 MB cada), gastando Storage e banda.
-- Janela de 10 minutos e dia (UTC); os valores ficam em app_limits (o dono ajusta sem deploy).
create table if not exists public.upload_tickets (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_key text not null,
  n integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, window_key)
);
alter table public.upload_tickets enable row level security; -- sem política: só o servidor
revoke all on public.upload_tickets from anon, authenticated;

insert into public.app_limits (key, value) values ('uploads_per_10min', 120), ('uploads_per_day', 400) on conflict (key) do nothing;

-- Conta um pedido e diz se ainda cabe. Atômico (INSERT ... ON CONFLICT trava a linha): dois pedidos ao mesmo
-- tempo não passam do limite.
create or replace function public.take_upload_ticket(p_user uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare short_n integer; day_n integer; short_lim integer; day_lim integer;
begin
  select value into short_lim from app_limits where key = 'uploads_per_10min';
  select value into day_lim from app_limits where key = 'uploads_per_day';
  insert into upload_tickets (user_id, window_key, n) values (p_user, 'm:' || floor(extract(epoch from now()) / 600)::bigint, 1)
    on conflict (user_id, window_key) do update set n = upload_tickets.n + 1 returning n into short_n;
  insert into upload_tickets (user_id, window_key, n) values (p_user, 'd:' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 1)
    on conflict (user_id, window_key) do update set n = upload_tickets.n + 1 returning n into day_n;
  delete from upload_tickets where user_id = p_user and created_at < now() - interval '2 days';
  return short_n <= coalesce(short_lim, 120) and day_n <= coalesce(day_lim, 400);
end $$;
revoke all on function public.take_upload_ticket(uuid) from public, anon, authenticated;
do $$ begin if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant execute on function public.take_upload_ticket(uuid) to service_role'; end if; end $$;
