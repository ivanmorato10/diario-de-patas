-- Comemoração das 200 patinhas vista (na conta, não só no aparelho): "<cachorro>:<AAAA-MM>", os mais recentes.
alter table public.profiles add column if not exists celebrated text[] not null default '{}';
