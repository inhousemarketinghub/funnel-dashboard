-- Phase 2 PR-B: cell-level marks the person aggregators depend on, plus the
-- lead tab's appointment-column presence (drives walk-in vs appointment
-- aggregation on the DB read path). All additive with defaults; the next
-- lead-tab sync (content-hash change) backfills real values.
alter table lead_rows add column if not exists appointment_marked boolean not null default false;
alter table lead_rows add column if not exists purchase_marked boolean not null default false;
alter table client_states add column if not exists lead_appointment_col boolean not null default true;
