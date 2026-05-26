# Ad Spend Breakdown + CPL Formula Fix

**Date:** 2026-05-26
**Status:** Approved pending user sign-off

## Context

The dashboard's "Total Ad Spend" card shows a single taxed figure (the sheet's
`Taxed Ad Spend` column), and CPL is computed as `taxed_total / leads`. This is
wrong for the business: total ad spend is actually composed of **Lead Funnel Ad
Spend** + **Branding Ad Spend** (both pre-tax), and CPL should only count the
lead-generation portion — `Lead Funnel / leads`. Branding spend inflates CPL today.

The user wants to (1) see Lead Funnel and Branding broken out on the Total Ad
Spend card, and (2) fix CPL to use only Lead Funnel spend.

### Verified sheet structure (`Performance Tracker@2990's`)
| Col | Header | Tax | Currently read? |
|-----|--------|-----|-----------------|
| [1] | Taxed Ad Spend | incl. 8% SST | yes → `ad_spend` |
| [2] | Lead Funnel Ad Spend | **pre-tax** | no |
| [3] | Branding Ad Spend | **pre-tax** | no |
| [4] | 8% SST | — | no |

Confirmed relationship (row-verified): `Taxed = (Lead Funnel + Branding) × 1.08`.

**Note:** For 2990's, the Lead Funnel column is currently all `RM0.00` (all spend
booked as Branding). Per user decision, CPL will therefore correctly show `RM0 / —`
until they populate the Lead Funnel column going forward.

## Decisions (locked with user)

1. **CPL = (Lead Funnel × 1.08) ÷ leads** — taxed numerator, matches the card
   breakdown and the sheet's own "Cost Per PM (Included 8% SST)" convention.
2. **Total Ad Spend card** — headline stays the taxed total (unchanged); add two
   breakdown lines, each shown ×1.08 (taxed) so `Lead Funnel + Branding = headline`.
3. **Backward compatibility** — clients whose sheets lack the split columns keep the
   old behavior (CPL = taxed total ÷ leads). Detected via
   `(lead_funnel_spend + branding_spend) > 0`.

## Changes

### `lib/types.ts`
- `DailyMetric`: add `lead_funnel_spend: number`, `branding_spend: number` (pre-tax).
- `FunnelMetrics`: add `lead_funnel_spend: number`, `branding_spend: number` (pre-tax sums).

### `lib/sheets.ts`
- `PerfColumnMap`: add `leadFunnelSpend: number | null`, `brandingSpend: number | null`.
- `detectPerfColumns`: detect `["lead funnel"]`+`["ad spend"]` and `["branding"]`+`["ad spend"]`.
  Keep existing `taxed ad spend` matcher for `adSpend` (headline total unchanged).
- `parsePerformanceRows`: populate the two new fields via `parseRM`; default `0` when column is null.
- `fetchPerformanceData` multi-brand merge: add `existing.lead_funnel_spend += ...` and `branding_spend += ...`.

### `lib/metrics.ts` (`computeMetrics`)
- Sum `lead_funnel_spend`, `branding_spend`.
- Replace CPL line with:
  ```ts
  const splitExists = lead_funnel_spend + branding_spend > 0;
  cpl: inquiry
    ? (splitExists ? (lead_funnel_spend * 1.08) / inquiry : ad_spend / inquiry)
    : 0,
  ```
- This single change propagates CPL correctly to Dashboard, Trends, Overview, Report
  (all call `computeMetrics`).

### `components/dashboard/hero-cards.tsx`
- In the "Total Ad Spend" card `expandContent` (both walk-in and appointment variants),
  prepend two lines: `Lead Funnel Ad Spend = RM {lead_funnel_spend × 1.08}` and
  `Branding Ad Spend = RM {branding_spend × 1.08}`, using existing `fmtRM`.

## Downstream notes (no change needed)
- `budgetScenario` derives inquiry from `spend / metrics.cpl`; mechanically still works
  with the new CPL. Out of scope.
- CPL *target* (`kpi.cpl`) is unchanged. Achievement already guards `m.cpl ? ... : 0`.

## Verification
1. `npx vitest run` — update `lib/metrics.test.ts` (CPL = lead-funnel-based; fallback case)
   and `lib/sheets.test.ts` (parse Lead Funnel / Branding columns). TDD: write these first.
2. `npm run build` — type check passes with new fields.
3. `npm run dev` → open `/[clientId]` for 2990's:
   - Total Ad Spend headline unchanged (taxed total).
   - Expand card → Lead Funnel + Branding lines sum to the headline.
   - CPL card shows `RM0 / —` (Lead Funnel currently 0) instead of RM205.63.
4. Sanity-check a client without the split columns: CPL unchanged from old behavior.
