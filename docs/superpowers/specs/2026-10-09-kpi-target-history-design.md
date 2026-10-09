# KPI Target History — Design Spec

**Date:** 2026-10-09
**Status:** Approved in brainstorming; pending spec review before implementation plan.

## Problem

Ads Projection KPI targets (sales, AOV, CPA%, CPL, conversion + funnel rates, daily budget)
are stored with **no history**:

- Google Sheet KPI tab is the source of truth — saving overwrites in place.
- `kpi_mirror` is a full delete+insert rebuild of the sheet (no history).
- `kpi_configs` is keyed `UNIQUE(client_id, month)` and **upserted** — each save
  overwrites the month's row; there is **no timestamp at all** (no created_at/updated_at).
- The dashboard's KPI target column is effectively **always "current"**: in
  `app/[clientId]/page.tsx` the resolved `kpi = sheetKPI || kpiRow || defaults`,
  and `sheetKPI` (today's live target) always wins over the per-month row.

Consequences the owner hit:
1. No way to track the history of each budget / KPI change (who changed what, when).
2. Cannot see, for a **past month**, the KPI target that was **in effect then** vs that
   month's actual performance — the dashboard only shows *today's* target vs past actuals.

Two owner-flagged edge cases:
- **A.** KPI may not be updated every month (next month == this month → no re-save).
- **B.** KPI may be updated 2+ times within a month (owner raises/lowers budget or CPA%
  mid-month).

Actuals are **not** a problem: `daily_metrics` stores per-day rows and is already
aggregated to any month/range by `getPerformanceData` + `computeMetrics`. This feature
is about giving the **target** side a history.

## Decisions (from brainstorming)

1. **Append-only snapshots.** Every save appends an immutable, timestamped **full
   snapshot** of the target set. Never overwrite. This single mechanism solves both
   edge cases:
   - **A (no update):** the effective target for a month = the latest snapshot with
     `effective_from ≤ that month's end` — a prior month's snapshot naturally carries
     forward.
   - **B (multiple updates):** every save is its own snapshot with its own timestamp;
     none are lost.
2. **Mid-month display policy:** the comparison uses the **month-end final target**
   (the snapshot in effect at month end) as "the month's target", PLUS an expandable
   **change timeline** for that period.
3. **Two surfaces:** (a) make the existing dashboard **period-accurate**, and (b) a new
   dedicated **KPI History** overview page.
4. **Backfill:** best-effort seed from existing `kpi_configs` rows so history is
   populated on day one (3–7 months per client), flagged as estimated/monthly.

## Architecture

New append-only table `kpi_target_versions`, written additively from the existing save
path, read by (a) a new effective-target resolver used on the dashboard and (b) a new
KPI History page. Existing tables (`kpi_configs`, `kpi_mirror`, sheet) are **unchanged** —
zero risk to current behavior.

Considered and rejected:
- **Reuse `activity_log` (event/diff log):** reconstructing "the full target in effect
  as of month X" from diffs is error-prone; snapshots answer that query directly.
- **Version `kpi_configs` in place (drop the unique key, append):** mixes a current-cache
  responsibility with history in one table and changes semantics other code relies on.

### 1. Data model — `kpi_target_versions`

```sql
create table kpi_target_versions (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(id) on delete cascade,
  brand          text not null default '',        -- '' = single-brand / unknown
  effective_from timestamptz not null,            -- when this target took effect
  snapshot       jsonb not null,                  -- full target set (see below)
  source         text not null default 'save',    -- 'save' | 'backfill'
  changed_by     uuid,                             -- agencies.id (null for backfill)
  created_at     timestamptz not null default now()
);
create index on kpi_target_versions (client_id, brand, effective_from desc);
```

`snapshot` jsonb carries the full target set saved in Ads Projection:
`{ sales, aov, cpa_pct, cpl, conv_rate, respond_rate, appt_rate, showup_rate, daily_ad, ad_spend }`
(same keys the `completeForm` / `kpi_configs` columns use).

RLS: SELECT scoped to users with access to the client (join `project_access`, mirror
existing policies); writes via the service-role client in `/api/kpi` (same pattern as
`kpi_configs`). Final policy wording in the implementation plan.

### 2. Write path (additive)

In `app/api/kpi/route.ts` POST, after the existing sheet write + `kpi_mirror` rebuild +
`kpi_configs` upsert, **append** one `kpi_target_versions` row:
`{ client_id, brand: brandName ?? '', effective_from: now(), snapshot: <saved target fields>, source: 'save', changed_by: <agencies.id from getUserRole> }`.
No existing write is changed; this is purely additive so current behavior is untouched.

### 3. Backfill (one-time migration)

For every existing `kpi_configs` row, insert a `kpi_target_versions` row:
- `effective_from` = **first day of that month, 00:00** (normalizing the inconsistent
  31st-of-month vs 1st-of-month keys currently in `kpi_configs`).
- `snapshot` = that row's target fields.
- `source = 'backfill'`, `changed_by = null`, `brand = ''`.

Limitations (documented, acceptable):
- `kpi_configs` has **no brand column**, so backfilled history is per-client (`brand=''`).
  Going forward, saves are captured per brand.
- Backfilled rows carry no precise time (month-start only); the UI labels them
  "Backfilled · monthly estimate".

### 4. Effective-target resolver (new, shared)

`lib/kpi-history.ts`:
- `effectiveTargetAsOf(clientId, brand, asOf: Date) → snapshot | null` — the latest
  `kpi_target_versions` snapshot with `effective_from ≤ asOf` (carry-forward built in).
- `versionsInRange(clientId, brand, start, end) → version[]` — for the change timeline,
  plus the one in effect at `start`, to render from→to diffs.
- Pure helpers for building the month list and diffing consecutive snapshots are unit-tested.

### 5. Dashboard — period-accurate (`app/[clientId]/page.tsx`)

- Compute `effectiveKpi = effectiveTargetAsOf(clientId, brand, reportEnd)` where
  `reportEnd` is the **end of the currently selected report range** (works for arbitrary
  ranges, not just whole months — it's "the monthly target in effect at the end of what
  you're viewing"). The existing pace scaling (rangeDays/daysInMonth) still applies on top.
- Resolution becomes: for the selected period, use `effectiveKpi` as the target feeding
  `MoMTable` / `HeroCards` / `KPIChart`. When the range ends **today/this month** this
  equals the latest snapshot (= today's target), so the current view is unchanged. When it
  ends in a **past** month it shows the historical target. Fall back to `sheetKPI`/defaults
  when no version exists (pre-history).
- Add a collapsible **"Target changes this period"** under the comparison that lists the
  versions effective in the selected range (date · what changed from → to), via
  `versionsInRange`.

### 6. KPI History page (`app/[clientId]/kpi-history/page.tsx`)

- Server component, gated by `view_projection`.
- Build the month list from the earliest version's month → current month.
- For each month: effective target (month-end) + actual metrics (reuse
  `getPerformanceData` + `computeMetrics` for that month) + achievement.
- Render a table: `Month | target (sales/budget/CPA%/CPL/…) | actual | achievement`.
  Each row expands to the **change timeline** for that month (from→to diffs; backfilled
  rows labelled). Legibility over compactness — no clipped numbers.
- Nav: add a **"KPI History"** item to the client sidebar + mobile nav, gated by
  `view_projection`.

## Edge cases

- **No version before the earliest month** → fall back to current sheet target / defaults;
  the history table starts at the earliest version's month.
- **Multi-brand:** versions are per `(client, brand)` going forward; backfilled history is
  `brand=''` only (data limitation above). History page respects the brand selector.
- **Current month, mid-month change:** the dashboard shows the latest snapshot (month-end
  policy applied as "as of now"); the timeline shows the intra-month changes.

## Out of scope (YAGNI)

- Charts/graphs of target-over-time (tables + timeline only).
- Editing/deleting history (immutable, append-only).
- Per-change notifications/alerts.
- CSV/PDF export of history (can follow later).

## Testing

- **Unit (`lib/kpi-history.test.ts`):** `effectiveTargetAsOf` (as-of lookup,
  carry-forward across gap months, multiple-in-month → month-end latest), snapshot diffing,
  month-list building. Pure functions, full precision.
- **Integration:** a save appends exactly one version with the right snapshot; backfill
  produces one normalized row per `kpi_configs` row.
- **Regression:** current-month dashboard KPI column unchanged (effectiveKpi == current
  snapshot for the current period).

## Rollout

- Additive migration (new table) + backfill migration — safe, no existing data touched.
- Ship behind normal PR flow; verify on a throwaway client with seeded versions, and
  confirm the current-month dashboard is byte-for-byte unchanged before merge.
