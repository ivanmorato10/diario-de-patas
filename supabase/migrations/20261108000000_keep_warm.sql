-- Servidor acordado (20/10/2026): depois de alguns minutos sem uso, a primeira resposta do app levava ~1 s a mais
-- (função "dormindo" na Vercel), e as fotos da tela Hoje demoravam a aparecer. Um agendamento no próprio banco
-- (pg_cron + pg_net, gratuitos no Supabase) chama o app a cada 5 minutos no horário de uso no Brasil
-- (7h à 1h de Brasília = 10h às 4h UTC): página, fotos, operações e versão, que acordam cada função do app.
-- As chamadas não têm sessão: só acordam o servidor (respondem 401/404), não leem nem gravam dados.
-- Sem pg_cron/pg_net (ex.: Postgres de teste local), não faz nada.
do $outer$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron/pg_net indisponíveis: agendamento para manter o servidor acordado não criado';
    return;
  end if;
  create extension if not exists pg_net with schema extensions;
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'manter-servidor-acordado') then
    perform cron.unschedule('manter-servidor-acordado');
  end if;
  perform cron.schedule('manter-servidor-acordado', '*/5 0-3,10-23 * * *', $job$
    select net.http_get('https://diario-de-patas.vercel.app/api/versao');
    select net.http_get('https://diario-de-patas.vercel.app/entrar');
    select net.http_get('https://diario-de-patas.vercel.app/api/media/00000000-0000-0000-0000-000000000000?v=thumb');
    select net.http_post(url := 'https://diario-de-patas.vercel.app/api/rpc/acordar', body := '{}'::jsonb);
  $job$);
end
$outer$;
