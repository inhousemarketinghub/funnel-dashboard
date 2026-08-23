-- C-tier Phase 1: data foundation (PRD docs/prd/2026-08-23-c-tier-data-foundation.md)
-- Sheets stay the entry surface; these tables become the dashboard's source of
-- truth per-client once clients.profile.data_source = 'db' (gradual rollout).
-- Writes go through the sync engine using the service role (bypasses RLS);
-- authenticated users get SELECT scoped exactly like the "Read clients" policy.

-- Per-client structured config ("项目档案"): funnel type, column aliases,
-- paid-ads source list, data_source switch. Empty object = all defaults.
alter table clients add column if not exists profile jsonb not null default '{}'::jsonb;

-- ── daily_metrics: mirror of the Performance Tracker, one row per client × brand × day
create table if not exists daily_metrics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  brand text not null default '',
  date date not null,
  ad_spend numeric not null default 0,
  lead_funnel_spend numeric not null default 0,
  branding_spend numeric not null default 0,
  inquiry integer not null default 0,
  contact integer not null default 0,
  appointment integer not null default 0,
  est_showup integer not null default 0,
  showup integer not null default 0,
  orders integer not null default 0,
  sales numeric not null default 0,
  synced_at timestamptz not null default now(),
  unique (client_id, brand, date)
);
create index if not exists daily_metrics_client_date_idx on daily_metrics (client_id, date);

-- ── lead_rows: mirror of the Lead & Sales Tracker, only the fields the app
-- aggregates. Deliberately NO lead name/phone — the DB holds less PII than the
-- sheet. Wholesale-replaced per client per sync (sheet rows have no stable id).
create table if not exists lead_rows (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  brand text not null default '',
  lead_date date,
  source text not null default '',
  appointment_person text not null default '',
  sales_person text not null default '',
  appointment_date date,
  showed_up boolean not null default false,
  purchase_date date,
  sales numeric not null default 0,
  synced_at timestamptz not null default now()
);
create index if not exists lead_rows_client_idx on lead_rows (client_id, lead_date);
create index if not exists lead_rows_client_appt_idx on lead_rows (client_id, appointment_date);

-- ── brand_states: parse metadata per client × brand at last sync — funnel type,
-- tracked columns, full column diagnosis snapshot (schema-drift detection later)
create table if not exists brand_states (
  client_id uuid not null references clients(id) on delete cascade,
  brand text not null default '',
  tab_name text not null,
  funnel_type text not null,
  tracked jsonb not null,
  columns jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (client_id, brand)
);

-- ── sync_runs: one row per sync attempt — the built-in monitoring feed
create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running', -- running | success | error
  trigger text not null,                  -- cron | manual | stale
  stats jsonb,                            -- {daily_upserts, lead_rows, quarantined, changes}
  error text
);
create index if not exists sync_runs_client_started_idx on sync_runs (client_id, started_at desc);

-- ── data_changes: audit trail (改要留痕). A daily_metrics value that differs
-- from the previous sync is recorded here — never blocked, always visible.
create table if not exists data_changes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  brand text not null default '',
  metric_date date not null,
  metric text not null,
  old_value numeric,
  new_value numeric,
  detected_at timestamptz not null default now(),
  sync_run_id uuid references sync_runs(id) on delete set null
);
create index if not exists data_changes_client_date_idx on data_changes (client_id, metric_date);

-- ── report_snapshots: monthly aggregate frozen when a report is generated;
-- later drift vs live data drives the "updated after report" badge (Phase 3)
create table if not exists report_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  month date not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (client_id, month)
);

-- ── quarantine_rows: rows the validator refused (e.g. unparseable dates) —
-- kept out of the mirror, surfaced on the diagnostics page. `sample` holds only
-- the offending cells, never full rows (PII discipline).
create table if not exists quarantine_rows (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  brand text not null default '',
  tab_name text not null,
  row_index integer,
  reason text not null,
  sample jsonb,
  sync_run_id uuid references sync_runs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists quarantine_client_idx on quarantine_rows (client_id, created_at desc);

-- ── RLS: SELECT for authenticated users with access to the client (same scope
-- as the clients "Read clients" policy); no public write policies — the sync
-- engine writes with the service role.
do $$
declare t text;
begin
  foreach t in array array['daily_metrics','lead_rows','brand_states','sync_runs','data_changes','report_snapshots','quarantine_rows'] loop
    execute format('alter table %I enable row level security', t);
    execute format($p$
      create policy "Read via client access" on %I for select using (
        client_id in (
          select c.id from clients c join agencies a on c.agency_id = a.id
            where lower(a.email) = lower(auth.jwt() ->> 'email')
          union
          select pa.client_id from project_access pa join agencies a on pa.agency_id = a.id
            where lower(a.email) = lower(auth.jwt() ->> 'email')
        )
      )$p$, t);
  end loop;
end $$;
