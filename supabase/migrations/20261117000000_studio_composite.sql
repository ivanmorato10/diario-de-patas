-- Arte com nome/mensagem/moldura: a versão composta (desenhada pelo app, a IA não escreve texto) passa a ser a imagem
-- da lembrança — Diário, álbum, link público e download mostram a mesma arte do resultado. A original fica em
-- output_asset_id; a composta em composite_asset_id — 24/10/2026.
alter table public.generation_jobs add column if not exists composite_asset_id uuid references public.media_assets (id) on delete set null;
