-- Proteção contra abuso em conteúdo compartilhado — 25/10/2026 (App Store 1.2).
-- Denúncias: de foto, cartinha, pessoa (dentro do app) e de álbum público (sem conta). Só o servidor lê; o suporte
-- recebe um email a cada denúncia e responde em até 24 h (Termos). Bloqueio: quem bloqueia para de ver o que a
-- pessoa bloqueada publica, não recebe avisos dela e ela não entra pelos convites dos diários de quem bloqueou.
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  target_type text not null check (target_type in ('entry', 'letter', 'user', 'share')),
  target_id text not null,
  dog_id uuid references public.dogs (id) on delete set null,
  reported_user_id uuid references auth.users (id) on delete set null,
  reason text not null check (reason in ('inappropriate', 'harassment', 'spam', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text
);
create index if not exists content_reports_open on public.content_reports (created_at) where resolved_at is null;
create index if not exists content_reports_reporter on public.content_reports (reporter_id, created_at);
create index if not exists content_reports_target on public.content_reports (target_type, target_id, created_at);
alter table public.content_reports enable row level security; -- sem política: só o servidor

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked on public.user_blocks (blocked_id);
alter table public.user_blocks enable row level security; -- sem política: só o servidor
