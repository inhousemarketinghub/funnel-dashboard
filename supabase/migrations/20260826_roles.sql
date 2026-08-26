-- Role-based access (owner-defined roles with feature checklists).
-- Additive only: existing project_access.permissions stays as fallback, so
-- production (pre-sidebar code) is unaffected until the new UI ships.

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- feature keys: view_trends, view_report, view_projection, save_projection,
  -- edit_customization, view_diagnostics, edit_settings, manage_access
  -- (view_dashboard is implicit for anyone assigned to a project)
  permissions jsonb not null default '[]'::jsonb,
  built_in boolean not null default false,
  created_at timestamptz not null default now()
);
alter table roles enable row level security;
-- Any signed-in team member may read role definitions (needed to resolve access)
create policy "Authenticated read roles" on roles for select to authenticated using (true);

alter table project_access add column if not exists role_id uuid references roles(id);

-- Seed the three defaults (idempotent)
insert into roles (name, permissions, built_in) values
  ('Manager', '["view_trends","view_report","view_projection","save_projection","edit_customization","view_diagnostics","edit_settings","manage_access"]'::jsonb, true),
  ('Supervisor', '["view_trends","view_report","view_projection"]'::jsonb, true),
  ('Viewer', '["view_trends"]'::jsonb, true)
on conflict (name) do nothing;

-- Migrate existing assignments to the nearest role (only rows not yet mapped)
update project_access pa set role_id = r.id
from roles r
where pa.role_id is null
  and r.name = case
    when 'edit_settings' = any(pa.permissions) or 'manage_access' = any(pa.permissions) then 'Manager'
    when 'view_report' = any(pa.permissions) then 'Supervisor'
    else 'Viewer'
  end;
