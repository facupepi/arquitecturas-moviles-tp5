-- Tareas programadas: pg_cron llama a la Edge Function tareas con pg_net.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
create extension if not exists pg_net with schema extensions;

-- Los secretos NO están en esta migración. Se cargan una vez desde el editor SQL
-- (o con `npx supabase db query --linked`):
--   select vault.create_secret('https://qsxwsbdhlwyshqjfxaxw.supabase.co', 'url_proyecto');
--   select vault.create_secret('<mismo valor que CRON_SECRET>', 'secreto_cron');
-- Si todavía no se cargaron los secretos de Vault, no llama a nada (cero filas) en vez de fallar.
create or replace function public.llamar_tarea(tarea text) returns void
language sql security definer set search_path = '' as $$
  select net.http_post(
    url := s.url || '/functions/v1/tareas',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.secreto),
    body := jsonb_build_object('tarea', tarea),
    timeout_milliseconds := 20000)
  from (select
          (select decrypted_secret from vault.decrypted_secrets where name = 'url_proyecto') as url,
          (select decrypted_secret from vault.decrypted_secrets where name = 'secreto_cron') as secreto) as s
  where s.url is not null and s.secreto is not null;
$$;
revoke execute on function public.llamar_tarea(text) from public, anon, authenticated;

-- cron.schedule con un nombre existente reemplaza el trabajo: la migración se puede repetir.
select cron.schedule('conecta-minuto',  '* * * * *',  $$ select public.llamar_tarea('minuto') $$);
select cron.schedule('conecta-diaria',  '0 12 * * *', $$ select public.llamar_tarea('diaria') $$);   -- 09:00 Córdoba
select cron.schedule('conecta-resumen', '0 23 * * *', $$ select public.llamar_tarea('resumen') $$);  -- 20:00 Córdoba
select cron.schedule('conecta-limpieza', '30 3 * * *', $$
  delete from cron.job_run_details where end_time < now() - interval '3 days';
  delete from public.ejecuciones where inicio < now() - interval '14 days';
$$);
