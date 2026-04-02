CREATE TABLE agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  sheet_id text NOT NULL,
  logo_url text,
  funnel_type text DEFAULT 'appointment',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE kpi_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  month date NOT NULL,
  sales numeric DEFAULT 300000,
  orders integer DEFAULT 6,
  aov numeric DEFAULT 50000,
  cpl numeric DEFAULT 26,
  respond_rate numeric DEFAULT 30,
  appt_rate numeric DEFAULT 33,
  showup_rate numeric DEFAULT 90,
  conv_rate numeric DEFAULT 25,
  ad_spend numeric DEFAULT 7500,
  daily_ad numeric DEFAULT 250,
  roas numeric DEFAULT 40,
  cpa_pct numeric DEFAULT 2.5,
  target_contact integer DEFAULT 80,
  target_appt integer DEFAULT 27,
  target_showup integer DEFAULT 24,
  UNIQUE(client_id, month)
);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  period text NOT NULL,
  html_url text,
  pdf_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own agency" ON agencies FOR SELECT USING (email = auth.jwt()->>'email');
CREATE POLICY "Users can insert own agency" ON agencies FOR INSERT WITH CHECK (email = auth.jwt()->>'email');
CREATE POLICY "Users can read own clients" ON clients FOR SELECT USING (agency_id IN (SELECT id FROM agencies WHERE email = auth.jwt()->>'email'));
CREATE POLICY "Users can insert own clients" ON clients FOR INSERT WITH CHECK (agency_id IN (SELECT id FROM agencies WHERE email = auth.jwt()->>'email'));
CREATE POLICY "Users can update own clients" ON clients FOR UPDATE USING (agency_id IN (SELECT id FROM agencies WHERE email = auth.jwt()->>'email'));
CREATE POLICY "Users can delete own clients" ON clients FOR DELETE USING (agency_id IN (SELECT id FROM agencies WHERE email = auth.jwt()->>'email'));
CREATE POLICY "Users can manage own kpi_configs" ON kpi_configs FOR ALL USING (client_id IN (SELECT c.id FROM clients c JOIN agencies a ON c.agency_id = a.id WHERE a.email = auth.jwt()->>'email'));
CREATE POLICY "Users can manage own reports" ON reports FOR ALL USING (client_id IN (SELECT c.id FROM clients c JOIN agencies a ON c.agency_id = a.id WHERE a.email = auth.jwt()->>'email'));
