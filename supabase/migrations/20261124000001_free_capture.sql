-- =============================================================================
-- Scanner 100 % gratuit : codes-barres (Open Food Facts), ticket de caisse et
-- date de péremption lus sur le téléphone (OCR local). Aucun appel d'IA payante.
-- Chaque ajout au stock est mesuré pour suivre la qualité de reconnaissance.
-- =============================================================================
alter type public.item_source add value if not exists 'receipt';

create table public.capture_events (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid references auth.users (id) on delete set null,
  method        text not null check (method in ('barcode', 'receipt', 'manual', 'ai_photo')),
  detected      integer not null default 0 check (detected between 0 and 500),   -- propositions automatiques
  confirmed     integer not null default 0 check (confirmed between 0 and 500),  -- produits ajoutés au stock
  corrected     integer not null default 0 check (corrected between 0 and 500),  -- propositions modifiées
  removed       integer not null default 0 check (removed between 0 and 500),    -- propositions supprimées
  created_at    timestamptz not null default now()
);
create index capture_events_created_idx on public.capture_events (created_at);
alter table public.capture_events enable row level security;
create policy "capture events insert" on public.capture_events for insert to authenticated
  with check (user_id = auth.uid() and public.can_write_household(household_id));
create policy "capture events admin read" on public.capture_events for select to authenticated using (public.is_admin());

-- Statistiques de reconnaissance et de coûts (espace admin).
create or replace function public.admin_capture_stats(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz := p_from::timestamptz;
  v_to   timestamptz := (p_to + 1)::timestamptz;
  v_rate numeric := (select eur_per_usd from public.finance_settings);
  v_res  jsonb;
begin
  perform public.assert_admin();
  with c as (select * from public.capture_events where created_at >= v_from and created_at < v_to),
  paid as (select coalesce(sum(cost_usd), 0) * v_rate cost_eur, count(*) calls
             from public.ai_usage_logs where feature = 'scan' and created_at >= v_from and created_at < v_to)
  select jsonb_build_object(
    'captures_total', (select count(*) from c),
    'by_method', coalesce((select jsonb_object_agg(method, n) from (select method, count(*) n from c group by method) x), '{}'::jsonb),
    'free_share', (select case when count(*) > 0 then round(count(*) filter (where method <> 'ai_photo')::numeric / count(*), 4) end from c),
    'paid_ai_calls', p.calls,
    'paid_ai_cost_eur', round(p.cost_eur, 4),
    'avg_cost_per_capture_eur', (select case when count(*) > 0 then round(p.cost_eur / count(*), 5) end from c),
    'avg_cost_per_user_eur', (select case when count(distinct user_id) > 0 then round(p.cost_eur / count(distinct user_id), 5) end from c),
    'items_detected', (select coalesce(sum(detected), 0) from c),
    'items_confirmed', (select coalesce(sum(confirmed), 0) from c),
    'corrections', (select coalesce(sum(corrected), 0) from c),
    'removals', (select coalesce(sum(removed), 0) from c),
    -- part des propositions automatiques acceptées sans modification
    'recognition_rate', (select case when sum(detected) > 0 then round(1 - (sum(corrected) + sum(removed))::numeric / sum(detected), 4) end from c),
    'recognition_by_method', coalesce((select jsonb_object_agg(method, rate) from (
        select method, round(1 - (sum(corrected) + sum(removed))::numeric / nullif(sum(detected), 0), 4) rate
          from c group by method having sum(detected) > 0) y), '{}'::jsonb)
  ) into v_res from paid p;
  return v_res;
end $$;
