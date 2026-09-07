-- Health digest notification center (owner-approved 2026-09-07). One daily
-- digest per client; session reads scoped by the same client-access RLS as
-- the mirror tables; writes service-role only. Already applied to prod.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  day date not null,
  kind text not null default 'daily_digest',
  severity text not null default 'info', -- info | warn | error
  body jsonb not null,
  created_at timestamptz not null default now(),
  unique (client_id, day, kind)
);
create index if not exists notifications_client_day_idx on notifications (client_id, day desc);
alter table notifications enable row level security;
do $$ begin
  create policy "Read via client access" on notifications for select using (
    client_id in (
      select c.id from clients c join agencies a on c.agency_id = a.id
        where lower(a.email) = lower(auth.jwt() ->> 'email')
      union
      select pa.client_id from project_access pa join agencies a on pa.agency_id = a.id
        where lower(a.email) = lower(auth.jwt() ->> 'email'))
  );
exception when duplicate_object then null; end $$;

-- Per-user read cursor: each user manages only their own row.
create table if not exists user_states (
  email text primary key,
  notifications_seen_at timestamptz
);
alter table user_states enable row level security;
do $$ begin
  create policy "Own state" on user_states for all
    using (lower(email) = lower(auth.jwt() ->> 'email'))
    with check (lower(email) = lower(auth.jwt() ->> 'email'));
exception when duplicate_object then null; end $$;
