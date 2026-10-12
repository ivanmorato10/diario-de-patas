-- Seed versionado do catálogo (espelha src/config/catalog.ts, CATALOG_VERSION = 1).
-- STATUS: não aplicado. Manter em sincronia; um teste de paridade está no backlog (Etapa C).
insert into public.mission_templates (id, slug, localized_title, visual_criterion, xp, collection_id, eligibility, prerequisite_id, subjective) values
('M01','ola-mundo','{"pt-BR":"Olá, mundo"}','{"pt-BR":"Cachorro claramente visível."}',10,'primeiras-lembrancas','any',null,false),
('M02','soneca-de-respeito','{"pt-BR":"Soneca de respeito"}','{"pt-BR":"Cachorro deitado ou descansando."}',10,'vida-em-casa','home','M01',false),
('M03','meu-brinquedo','{"pt-BR":"Meu brinquedo"}','{"pt-BR":"Cachorro e um brinquedo visíveis na foto."}',15,'vida-em-casa','home','M01',false),
('M04','hora-da-refeicao','{"pt-BR":"Hora da refeição"}','{"pt-BR":"Cachorro junto ao pote ou à comida habitual."}',10,'vida-em-casa','home','M01',false),
('M05','meu-cantinho','{"pt-BR":"Meu cantinho"}','{"pt-BR":"Cachorro em um local de descanso."}',10,'vida-em-casa','home','M01',false),
('M06','dupla-inseparavel','{"pt-BR":"Dupla inseparável"}','{"pt-BR":"Cachorro junto de uma pessoa."}',15,'nosso-vinculo','people','M01',false),
('M07','explorador-do-parque','{"pt-BR":"Explorador do parque"}','{"pt-BR":"Cachorro em ambiente externo com cara de parque ou jardim."}',20,'pequenas-aventuras','outdoor','M01',false),
('M08','pe-na-rua','{"pt-BR":"Pé na rua"}','{"pt-BR":"Cachorro em um passeio ao ar livre."}',15,'pequenas-aventuras','outdoor','M01',false),
('M09','amizade-de-patas','{"pt-BR":"Amizade de patas"}','{"pt-BR":"Dois ou mais cachorros enquadrados."}',20,'pequenas-aventuras','social-dogs','M01',false),
('M10','momento-engracado','{"pt-BR":"Momento engraçado"}','{"pt-BR":"Cachorro na foto. O humor não é avaliado."}',10,'manias-e-expressoes','any','M01',true),
('M11','companhia-tranquila','{"pt-BR":"Companhia tranquila"}','{"pt-BR":"Cachorro descansando perto de uma pessoa."}',15,'nosso-vinculo','people','M01',false),
('M12','cara-de-capa','{"pt-BR":"Cara de capa"}','{"pt-BR":"Retrato com o cachorro claramente visível."}',10,'manias-e-expressoes','any','M01',false)
on conflict (id) do nothing;
