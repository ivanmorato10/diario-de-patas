-- Português e inglês (18/10/2026).
-- * Idioma, região do calendário e unidade de peso são da PESSOA (profiles), não do cachorro:
--   integrantes do mesmo diário podem usar idiomas diferentes. null = ainda não escolheu (vale a sugestão do idioma).
-- * O peso continua guardado só em kg (weights.kg); libras existem só na entrada e na tela.
-- * Datas dos Estados Unidos (região "US"): National Dog Day (26/8) e Thanksgiving (4ª quinta de novembro).
--   A recompensa é por cachorro, missão e ano (mission_instances único): trocar idioma ou região não repete pontos.

-- profiles.locale já existia (not null default 'pt-BR', nunca escolhido pela pessoa). Quem já usa o app continua em
-- português; contas novas começam sem escolha (o app grava o idioma efetivo no primeiro acesso).
alter table public.profiles alter column locale drop not null;
alter table public.profiles alter column locale drop default;
alter table public.profiles drop constraint if exists profiles_locale_check;
alter table public.profiles add constraint profiles_locale_check check (locale in ('pt-BR', 'en'));
alter table public.profiles add column if not exists region text check (region in ('BR', 'US'));
alter table public.profiles add column if not exists weight_unit text check (weight_unit in ('kg', 'lb'));

alter table public.mission_templates drop constraint if exists mission_templates_studio_theme_check;
alter table public.mission_templates add constraint mission_templates_studio_theme_check
  check (studio_theme in ('aniversario', 'halloween', 'natal', 'national-dog-day', 'thanksgiving'));

-- Banco novo: o seed (supabase/seed.sql) já traz S04/S05; aqui só entra onde o catálogo já existe (produção).
insert into public.mission_templates (id, slug, localized_title, visual_criterion, xp, collection_id, eligibility, prerequisite_id, subjective, kind, slot, portrait, advances_item, studio_theme)
select v.id, v.slug, v.localized_title::jsonb, v.visual_criterion::jsonb, v.xp, v.collection_id, v.eligibility, v.prerequisite_id, v.subjective, v.kind, v.slot, v.portrait, v.advances_item, v.studio_theme from (values
  ('S04','especial-national-dog-day','{"pt-BR":"Dia Nacional do Cachorro","en":"National Dog Day"}','{"pt-BR":"O cachorro curtindo o dia dele.","en":"The dog enjoying their special day."}',20,'estacoes-e-datas','any','M01',false,'special',null,false,null,'national-dog-day'),
  ('S05','especial-thanksgiving','{"pt-BR":"Ação de Graças","en":"Thanksgiving"}','{"pt-BR":"O cachorro num cantinho aconchegante com clima de outono.","en":"The dog in a cozy spot with fall vibes."}',20,'estacoes-e-datas','home','M01',false,'special',null,false,null,'thanksgiving')
) as v (id, slug, localized_title, visual_criterion, xp, collection_id, eligibility, prerequisite_id, subjective, kind, slot, portrait, advances_item, studio_theme)
where exists (select 1 from public.mission_templates where id = 'M01')
on conflict (id) do nothing;
