-- Região e unidade de peso deixam de acompanhar o idioma (18/10/2026).
-- O idioma só sugere região e unidade uma vez; a partir daí elas ficam gravadas no perfil. Quem já tem idioma
-- gravado recebe agora a sugestão correspondente, para que trocar o idioma depois não mude loja, compra, feriados
-- nem kg/lb. Contas sem idioma gravado recebem os três juntos na primeira gravação (app e setPreferences).
update public.profiles set region = case when locale = 'en' then 'US' else 'BR' end where region is null and locale is not null;
update public.profiles set weight_unit = case when locale = 'en' then 'lb' else 'kg' end where weight_unit is null and locale is not null;
