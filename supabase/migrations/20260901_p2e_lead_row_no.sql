-- Phase 2 PR-E: stable sheet-order for lead_rows (mirror reads were ordered
-- by random uuid, breaking tie-order parity in person/source aggregation).
-- Backfilled by the next lead-tab rewrite; null until then.
alter table lead_rows add column if not exists row_no integer;
