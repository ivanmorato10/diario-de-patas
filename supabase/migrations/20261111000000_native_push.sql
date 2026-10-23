-- Avisos no app do iPhone (App Store) pelo serviço de avisos da Apple (APNs) — 23/10/2026.
-- A mesma tabela dos avisos do navegador: kind 'web' (Web Push, como antes) ou 'apns' (app do iPhone; endpoint =
-- "apns:<token do aparelho>", sem chaves de Web Push). Um aparelho continua ligado a uma conta só (endpoint único).
alter table public.push_subscriptions add column if not exists kind text not null default 'web';
alter table public.push_subscriptions drop constraint if exists push_subscriptions_kind_check;
alter table public.push_subscriptions add constraint push_subscriptions_kind_check check (kind in ('web', 'apns'));
alter table public.push_subscriptions alter column p256dh drop not null;
alter table public.push_subscriptions alter column auth drop not null;
alter table public.push_subscriptions drop constraint if exists push_subscriptions_web_keys;
alter table public.push_subscriptions add constraint push_subscriptions_web_keys check (kind <> 'web' or (p256dh is not null and auth is not null));
