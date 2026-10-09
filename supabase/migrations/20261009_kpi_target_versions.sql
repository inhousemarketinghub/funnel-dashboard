-- Append-only history of Ads Projection KPI target saves. Each save appends one
-- immutable full snapshot; rows are never updated or deleted. Written by
-- /api/kpi POST (service role); read-only RLS mirrors the other client-scoped
-- tables (kpi_mirror / notifications).
create table if not exists kpi_target_versions (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(id) on delete cascade,
  brand          text not null default '',
  effective_from timestamptz not null,
  snapshot       jsonb not null,
  source         text not null default 'save' check (source in ('save','backfill')),
  changed_by     uuid,
  created_at     timestamptz not null default now()
);
create index if not exists kpi_target_versions_lookup
  on kpi_target_versions (client_id, brand, effective_from desc);
alter table kpi_target_versions enable row level security;
do $$ begin
  create policy "Read via client access" on kpi_target_versions for select using (
    client_id in (
      select c.id from clients c join agencies a on c.agency_id = a.id
        where lower(a.email) = lower(auth.jwt() ->> 'email')
      union
      select pa.client_id from project_access pa join agencies a on pa.agency_id = a.id
        where lower(a.email) = lower(auth.jwt() ->> 'email'))
  );
exception when duplicate_object then null; end $$;
