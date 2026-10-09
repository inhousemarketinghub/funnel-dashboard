-- One-time seed: each existing kpi_configs row -> a backfilled snapshot dated to
-- the month start (normalizing the inconsistent 31st-of-month vs 1st-of-month
-- keys currently in kpi_configs). Idempotent: skips if a backfill row already
-- exists for that client/month. kpi_configs has no brand column, so backfilled
-- history is per-client (brand=''); going-forward saves are captured per brand.
insert into kpi_target_versions (client_id, brand, effective_from, snapshot, source, changed_by)
select
  k.client_id, '',
  date_trunc('month', k.month)::timestamptz,
  jsonb_build_object(
    'sales', coalesce(k.sales,0), 'orders', coalesce(k.orders,0), 'aov', coalesce(k.aov,0),
    'cpl', coalesce(k.cpl,0), 'respond_rate', coalesce(k.respond_rate,0),
    'appt_rate', coalesce(k.appt_rate,0), 'showup_rate', coalesce(k.showup_rate,0),
    'conv_rate', coalesce(k.conv_rate,0), 'ad_spend', coalesce(k.ad_spend,0),
    'daily_ad', coalesce(k.daily_ad,0), 'roas', coalesce(k.roas,0), 'cpa_pct', coalesce(k.cpa_pct,0),
    'target_contact', coalesce(k.target_contact,0), 'target_appt', coalesce(k.target_appt,0),
    'target_showup', coalesce(k.target_showup,0)
  ),
  'backfill', null
from kpi_configs k
where not exists (
  select 1 from kpi_target_versions v
  where v.client_id = k.client_id and v.source = 'backfill'
    and v.effective_from = date_trunc('month', k.month)::timestamptz
);
