-- Autorização para enviar fotos à IA (Google Gemini) no Estúdio — 25/10/2026 (App Store 5.1.2(i)).
-- Sem autorização na versão atual do texto, o servidor não envia nenhuma foto ao provedor (nem para conferir).
-- Retirar a autorização zera os campos. Nova versão do texto = pedir de novo.
alter table public.profiles add column if not exists ai_consent_version integer;
alter table public.profiles add column if not exists ai_consent_at timestamptz;
