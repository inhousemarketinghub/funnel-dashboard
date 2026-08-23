-- Per-client sync state: content hash of the lead tab so unchanged 20k-row
-- tabs are skipped instead of wholesale-rewritten every 15 minutes.
create table if not exists client_states (
  client_id uuid primary key references clients(id) on delete cascade,
  lead_hash text not null default '',
  updated_at timestamptz not null default now()
);
alter table client_states enable row level security;
create policy "Read via client access" on client_states for select using (
  client_id in (
    select c.id from clients c join agencies a on c.agency_id = a.id
      where lower(a.email) = lower(auth.jwt() ->> 'email')
    union
    select pa.client_id from project_access pa join agencies a on pa.agency_id = a.id
      where lower(a.email) = lower(auth.jwt() ->> 'email')
  )
);
