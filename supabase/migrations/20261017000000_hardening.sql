-- Ajustes apontados pelo verificador de segurança do Supabase (db advisors): search_path fixo nas funções de gatilho.
alter function public.documents_quota() set search_path = public;
alter function public.check_dog_photo_owner() set search_path = public;
