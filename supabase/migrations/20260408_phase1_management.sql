-- Phase 1: Management Foundation
-- Apply via Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Extend agencies table
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 10;

-- 2. Extend clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS column_mapping JSONB;

-- 3. Extend project_access table
ALTER TABLE project_access ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'viewer';
ALTER TABLE project_access ADD COLUMN IF NOT EXISTS invited_by UUID;
ALTER TABLE project_access ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ DEFAULT now();

-- 4. Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'viewer')),
  client_ids UUID[] NOT NULL,
  token TEXT UNIQUE NOT NULL,
  invited_by UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted BOOLEAN DEFAULT false,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) NOT NULL,
  user_id UUID,
  client_id UUID REFERENCES clients(id),
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_agency ON activity_log(agency_id, created_at DESC);

-- 6. Enable RLS on new tables
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for invitations
CREATE POLICY "Agency owners can manage invitations"
  ON invitations FOR ALL
  USING (agency_id IN (SELECT id FROM agencies WHERE email = auth.jwt() ->> 'email' AND role = 'owner'));

-- 8. RLS policies for activity_log
CREATE POLICY "Agency members can view activity log"
  ON activity_log FOR SELECT
  USING (agency_id IN (SELECT id FROM agencies WHERE email = auth.jwt() ->> 'email'));

-- 9. Set existing project_access records to 'owner' role where applicable
UPDATE project_access pa
SET role = 'owner'
FROM agencies a, clients c
WHERE pa.agency_id = a.id
  AND pa.client_id = c.id
  AND c.agency_id = a.id
  AND a.role = 'owner'
  AND (pa.role IS NULL OR pa.role = 'viewer');
