-- Speed project C: mirror of the KPI tab (targets + derived formula cells)
-- so Projection and db-mode KPI reads stop hitting Google live. Written by
-- the sync engine and by /api/kpi POST (write-through refresh); read-only RLS
-- like the other mirror tables. Already applied to prod via MCP 2026-09-04.
create table if not exists kpi_mirror (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  brand text not null default '',
  kpi jsonb not null,
  derived jsonb not null,
  position integer not null default 0,
  synced_at timestamptz not null default now(),
  unique (client_id, brand)
);
alter table kpi_mirror enable row level security;
do $$ begin
  create policy "Read via client access" on kpi_mirror for select using (
    client_id in (
      select c.id from clients c join agencies a on c.agency_id = a.id
        where lower(a.email) = lower(auth.jwt() ->> 'email')
      union
      select pa.client_id from project_access pa join agencies a on pa.agency_id = a.id
        where lower(a.email) = lower(auth.jwt() ->> 'email'))
  );
exception when duplicate_object then null; end $$;
