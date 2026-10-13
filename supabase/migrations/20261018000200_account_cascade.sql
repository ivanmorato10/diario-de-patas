-- Excluir a conta apaga tudo em cascata (MUDANCAS-V2 §8.2). Duas chaves sem ação travavam a exclusão
-- do usuário (erro 23503). No uso normal nada muda: lembranças são excluídas de forma lógica (deleted_at).
alter table public.mission_completions drop constraint mission_completions_accepted_submission_id_fkey,
  add constraint mission_completions_accepted_submission_id_fkey foreign key (accepted_submission_id) references public.mission_submissions (id) on delete cascade;
alter table public.diary_entries drop constraint diary_entries_media_asset_id_fkey,
  add constraint diary_entries_media_asset_id_fkey foreign key (media_asset_id) references public.media_assets (id) on delete cascade;
