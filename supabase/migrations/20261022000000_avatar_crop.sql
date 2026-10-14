-- Ajuste da foto de perfil (zoom e posição) — o círculo mostra a parte que a pessoa escolheu.
alter table public.dogs add column if not exists avatar_crop jsonb;
