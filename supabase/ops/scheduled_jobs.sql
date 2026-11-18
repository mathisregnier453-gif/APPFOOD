-- Tâches planifiées (appliqué sur le projet de production le 2026-11-18).
-- Prérequis : extensions pg_cron et pg_net, secret Vault « sauge_cron_secret »
-- identique au secret CRON_SECRET des edge functions (voir docs/OPERATIONS.md).
-- Remplacer fnkoiofhvgpgqvocnwcc par la référence du projet si besoin.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.call_scheduled_function(p_name text) returns bigint
language sql security definer set search_path = '' as $$
  select net.http_post(
    url := 'https://fnkoiofhvgpgqvocnwcc.supabase.co/functions/v1/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sauge_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
$$;
revoke execute on function public.call_scheduled_function(text) from public, anon, authenticated;

select cron.unschedule(jobname) from cron.job where jobname in ('sauge-push-dispatch', 'sauge-purge-photos', 'sauge-ai-rollup');
select cron.schedule('sauge-push-dispatch', '* * * * *', $$select public.call_scheduled_function('push-dispatch')$$);
select cron.schedule('sauge-purge-photos', '7 * * * *', $$select public.call_scheduled_function('purge-scan-photos')$$);
select cron.schedule('sauge-ai-rollup', '17 2 * * *', $$select public.rollup_ai_usage(current_date - 1); select public.purge_old_logs();$$);
