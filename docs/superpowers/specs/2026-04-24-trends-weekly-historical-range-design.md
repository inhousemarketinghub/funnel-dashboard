# Trends — Weekly Granularity + Historical Range Picker

> Upgrade the Trends page from fixed "last 6 months" monthly rolling to "arbitrary time range × Monthly/Weekly granularity" with explicit partial-period rendering.

## Context

The existing Trends page (`/[clientId]/trends`) shows a monthly line chart over the last 6 months ending today. Two pain points:

1. **No weekly view.** Marketing operations (ad budget, funnel health) run on weekly cadence. Users who want to track week-over-week trends currently have to leave the dashboard and look at Google Sheet directly.
2. **No historical navigation.** The 6-month window is hard-coded to end at `now`. Users who want to look at Q3 2025 performance or compare same-quarter across years can't do it.

This spec unifies these into one iteration: add a Monthly/Weekly granularity toggle and a full date-range picker that lets users move the window anywhere in time.

## Goals

- Users can toggle between Monthly and Weekly trend views on the Trends page.
- Weekly view default shows the last 4 completed-or-in-progress Mon-Sun weeks.
- Monthly view default unchanged: last 6 months.
- Users can pick any historical range via a date-range picker (e.g., Jan 1 2025 – Jun 30 2025 in Monthly, or Jul 7 2025 – Aug 3 2025 in Weekly).
- Partial periods (e.g., current in-progress week/month) are rendered visibly distinct so users don't mistake them for a decline.
- URL is the single source of truth — shareable links reproduce exact view.

## Non-Goals

- Daily / Quarterly / Yearly granularity (deferred).
- Dashed last line segment on partial periods (Recharts limitation — hollow dot is MVP).
- Cross-period comparison on Trends page (Dashboard has it; Trends remains single-series view).
- localStorage-based user preference memory (URL handles share + reload sufficiently).
- PDF export of trend charts.

## Design Decisions Summary

| # | Decision | Choice |
|---|---|---|
| 1 | Toggle UX | Segmented pill `[Monthly \| Weekly]` |
| 2 | Granularity switch behavior | Reset range to granularity's default |
| 3 | Partial period rendering | Include in data; hollow-ring dot + `(incomplete)` tooltip suffix |
| 4 | Week X-axis label | `"Apr 14 – 20"` (Mon-Sun range) |
| 5 | Default granularity on page load | Weekly |
| 6 | Monthly presets | Last 3 / 6 / 12 months, YTD, Custom |
| 7 | Weekly presets | Last 4 / 8 / 12 / 26 weeks, Custom |
| 8 | Max range cap | 104 weeks / 24 months (UI-level guard in DateRangePicker) |

## Architecture

Three layers, consistent with the existing project structure:

```
┌──────────── UI (trends-client.tsx) ─────────────┐
│ GranularityToggle + DateRangePicker + BrandDropdown
│     ↓ router.push                                
│     ↓ URL: ?granularity=weekly&from=...&to=...  
└─────────────────────────────────────────────────┘
                      ↓ Next.js SSR re-render
┌─────── Route (page.tsx) ────────────────────────┐
│ resolveTrendParams(searchParams) → 
│   { granularity, from (snapped), to (snapped), brand }
│     ↓
│ fetchTrends({ sheetId, granularity, from, to, brand })
└─────────────────────────────────────────────────┘
                      ↓
┌─────── Data (lib/trends.ts) ────────────────────┐
│ getWeekRanges(from, to) OR getMonthRanges(from, to)
│     ↓ each range: filter daily rows → computeMetrics
│     ↓
│ TrendPoint[] { label, isPartial, metrics }
└─────────────────────────────────────────────────┘
                      ↓ props
┌──────── <TrendChart> ───────────────────────────┐
│ Recharts LineChart; custom dot renders hollow ring
│ for payload.isPartial === true
└─────────────────────────────────────────────────┘
```

## URL Protocol

Single source of truth. `page.tsx` is purely a function of URL params (plus session auth).

```
/<clientId>/trends?granularity=<weekly|monthly>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>&brand=<name>
```

**Defaults when params missing or invalid:**
- `granularity` → `weekly`
- `from` / `to` → `getDefaultRange(granularity)` (Weekly: last 4 weeks Mon-Sun; Monthly: last 6 months)
- `brand` → `Overall` (not set in URL)

**Snap-on-Apply invariant:** the UI snaps dates to granularity boundaries *before* writing to URL. This makes the URL idempotent — refreshing or re-clicking the same preset does not drift.

**Fallback on invalid:** bad date format / `from > to` / unknown `granularity` value → silently fall back to default. No 500 or redirect; preserves shareable-link robustness.

## Data Layer Changes

### `lib/dates.ts` — additions (~70 lines)

```ts
export type Granularity = "weekly" | "monthly";

export function getMondayOf(d: Date): Date;
export function getSundayOf(d: Date): Date;

export function snapToGranularity(
  range: DateRangeObj,
  granularity: Granularity,
): DateRangeObj;

export function getDefaultRange(
  granularity: Granularity,
  now?: Date,
): DateRangeObj;

export function isPartialRange(to: Date, now?: Date): boolean;
// Returns: to > now (strict greater). Current week/month with end-date in future = partial.

export function formatWeekLabel(from: Date, to: Date): string;
// "Apr 14 – 20" when same-month; "Mar 30 – Apr 5" when crossing month boundary.
```

`getMondayOf` / `getSundayOf` refactor the Mon-Sun math currently inline in `getPresetRange()` (dates.ts:86–101).

### `lib/trends.ts` — refactor (~80 lines net)

**New types:**
```ts
export type Granularity = "weekly" | "monthly";

export interface TrendPoint {
  label: string;        // "Apr 14 – 20" or "Nov 2025"
  isPartial: boolean;
  metrics: FunnelMetrics;
}

export interface TrendRange {
  from: Date;
  to: Date;
  label: string;
  isPartial: boolean;
}

// Backward-compat alias; grep consumers before deleting.
export type MonthlyTrendPoint = TrendPoint;
```

**New unified fetcher:**
```ts
export async function fetchTrends(opts: {
  sheetId: string;
  granularity: Granularity;
  from: Date;
  to: Date;
  brandName?: string | null;
}): Promise<TrendPoint[]>;
```

Internally dispatches to `getWeekRanges(from, to)` or `getMonthRanges(from, to)` then runs the existing "filter daily rows by range → computeMetrics" loop.

**Signature change (breaking):**
- Old: `getMonthRanges(count: number, now?: Date)` → range count from `now` backwards
- New: `getMonthRanges(from: Date, to: Date, now?: Date)` → all months covered by the inclusive range

A tiny wrapper preserves the old call site during migration:
```ts
// deprecated; prefer getMonthRanges(from, to)
export function getMonthRangesByCount(count: number, now?: Date): TrendRange[] {
  const end = now ?? new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - (count - 1), 1);
  return getMonthRanges(start, new Date(end.getFullYear(), end.getMonth() + 1, 0), end);
}
```

**New:**
```ts
export function getWeekRanges(from: Date, to: Date, now?: Date): TrendRange[];
```
Assumes `from` is snapped to Monday and `to` is snapped to Sunday. Iterates in 7-day steps, emits one `TrendRange` per week with `isPartial = isPartialRange(weekEnd, now)`.

**Shared helper extracted:**
```ts
function zeroMetrics(): FunnelMetrics {
  return {
    ad_spend: 0, inquiry: 0, contact: 0, appointment: 0, showup: 0,
    est_showup: 0, orders: 0, sales: 0, cpl: 0, respond_rate: 0,
    appt_rate: 0, showup_rate: 0, conv_rate: 0, aov: 0, roas: 0, cpa_pct: 0,
  };
}
```
Replaces the two literal copies currently in `fetchMonthlyTrends`.

## UI Components

### `components/trends/granularity-toggle.tsx` — new (~40 lines)

```tsx
interface Props {
  value: Granularity;
  onChange: (next: Granularity) => void;
  pending?: boolean;
}
```

Renders a segmented pill `[Monthly | Weekly]` styled consistent with the Dashboard/Trends nav pill (`.pill` / `.pill-active` CSS). When `pending`, reduced opacity during `startTransition`.

### `components/dashboard/date-range-picker.tsx` — parameterize (~+25 lines)

New optional props; defaults preserve current behavior for the Dashboard page:

```ts
interface Props {
  clientId: string;
  basePath?: string;        // default `/${clientId}` (Dashboard); Trends passes `/${clientId}/trends`
  presets?: DatePreset[];   // default DATE_PRESETS; Trends passes MONTHLY_PRESETS or WEEKLY_PRESETS
  onChange?: (range: DateRangeObj) => void;  // optional callback before router.push
  maxRange?: { weeks?: number; months?: number };  // sanity cap; disables Apply + shows inline message
}
```

New preset constants:
```ts
export const MONTHLY_PRESETS = [
  { label: "Last 3 months", value: "last-3m" },
  { label: "Last 6 months", value: "last-6m" },
  { label: "Last 12 months", value: "last-12m" },
  { label: "YTD", value: "ytd" },
] as const;

export const WEEKLY_PRESETS = [
  { label: "Last 4 weeks", value: "last-4w" },
  { label: "Last 8 weeks", value: "last-8w" },
  { label: "Last 12 weeks", value: "last-12w" },
  { label: "Last 26 weeks", value: "last-26w" },
] as const;
```

`getPresetRange()` in `lib/dates.ts` grows to handle the new preset values — each returns an already-snapped `DateRangeObj`.

### `components/trends/trend-chart.tsx` — refactor (~30 lines)

- Rename prop field `month` → `label`.
- Update Recharts `<XAxis dataKey="month">` → `dataKey="label"`.
- Inject custom `dot` render function:

```tsx
function renderDot(color: string) {
  return (props: { cx?: number; cy?: number; payload?: TrendPoint }) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy || !payload) return null;
    if (payload.isPartial) {
      return (
        <circle cx={cx} cy={cy} r={4} fill="var(--bg)" stroke={color} strokeWidth={2} />
      );
    }
    return <circle cx={cx} cy={cy} r={4} fill={color} />;
  };
}
```

- Tooltip formatter prepends `(incomplete) ` to the period label when `payload.isPartial`.
- Dashed last-segment rendering is **out of scope** — Recharts does not support per-segment stroke natively. Hollow dot + tooltip suffix is deemed sufficient signaling.

### `app/[clientId]/trends/trends-client.tsx` — rework (~40 lines changed)

- Accept new props: `granularity: Granularity`, `range: DateRangeObj`.
- Render `<GranularityToggle>` + `<DateRangePicker>` + `<BrandDropdown>` in one right-aligned row below the title.
- Dynamic subtitle: `"{Weekly|Monthly} performance · {formatRangeLabel(range.from, range.to)} ({N} {weeks|months})"`.
- `handleGranularityChange(next)` pushes new URL with `granularity=next` and `from/to = getDefaultRange(next)` — does NOT preserve current range (decision #3 in approved design).

### `app/[clientId]/trends/page.tsx` — minor (~15 lines)

Replace direct `fetchMonthlyTrends` call with `fetchTrends`; add `resolveTrendParams` URL parser; pass resolved granularity + range into `<TrendsClient>`.

## Error Handling & Edge Cases

| Condition | Behavior |
|---|---|
| `granularity=daily` or other unknown value | Silent fallback to `weekly` |
| `from` invalid / `to` invalid / `from > to` | Silent fallback to `getDefaultRange(granularity)` |
| Google Sheet fetch throws | Each range returns `zeroMetrics()` (existing behavior preserved) |
| Selected range contains zero data (all metrics zero in every bucket) | Show muted hint under chart: `"No data in selected range. Check the sheet or pick a different period."` |
| Custom range exceeds cap (> 104 weeks / > 24 months) | `DateRangePicker` disables Apply, shows inline text: `"Select a range ≤ 104 weeks for performance reasons."` |
| User rapid-fires granularity toggle during in-flight transition | `useTransition` handles; toggle stays responsive at reduced opacity |
| TZ edge case | All date constructors use local-TZ `new Date(y, m, d)` form (matches existing `dates.ts` convention) |

## Testing Strategy

All tests use vitest (existing convention; 17 tests currently pass).

### `lib/__tests__/dates.test.ts` — new file

- `getMondayOf()` — test every day of week returns correct Monday
- `getSundayOf()` — same for Sunday
- `snapToGranularity()` — weekly and monthly cases; weekday-to-Mon / weekday-to-Sun snapping; mid-month → 1st/last
- `getDefaultRange("weekly", now)` with fixed `now=Apr 24 2026` → expect `{ from: Mar 30 2026, to: Apr 26 2026 }`
- `getDefaultRange("monthly", now)` with same now → expect `{ from: Nov 1 2025, to: Apr 30 2026 }`
- `isPartialRange()` — `to` future / today / past
- `formatWeekLabel()` — same-month week and cross-month week
- Year-boundary edge case: `getMondayOf(Jan 1 2026)` → `Dec 29 2025`

### `lib/__tests__/trends.test.ts` — extend

- `getWeekRanges(Mar 30, Apr 26, now=Apr 24 2026)` → 4 ranges; last one `isPartial: true`
- `getMonthRanges(Nov 1 2025, Apr 30 2026, now=Apr 24 2026)` → 6 ranges; last one `isPartial: true`
- `getMonthRanges(Jan 1 2024, Jun 30 2024, now=Apr 24 2026)` → 6 ranges; all `isPartial: false` (historical)
- `fetchTrends({ granularity: "weekly", ... })` — mock `fetchPerformanceData` returning fixed daily rows; assert bucket metrics match hand-computed expected values
- `fetchTrends({ granularity: "monthly", ... })` — same approach, verify parity with old `fetchMonthlyTrends` output given equivalent inputs
- Migrate the existing two `getMonthRanges(count)` tests to the new `(from, to)` signature

### Manual smoke tests — pre-merge

1. Open `/<clientId>/trends` → default Weekly × last 4 weeks; last week renders hollow dot
2. Click `[Monthly]` → range resets to last 6 months; URL updates
3. DateRangePicker → Custom → pick Jan 1 2025 – Apr 30 2025 in Monthly → 4 solid-dot monthly points
4. Toggle back to Weekly → range resets to last 4 weeks (decision #3 verification)
5. Refresh browser → URL-derived state restores exactly
6. Manually edit URL to `?granularity=weekly&from=2025-07-07&to=2025-08-03` → loads Jul 7–Aug 3 2025 as 4 weekly points, all solid (historical)
7. Set `from=bad-date` in URL → silently falls back to default
8. Change Brand dropdown → trend re-filters; granularity + range preserved
9. Hover a partial dot → tooltip shows `(incomplete)` prefix
10. Browser console → no errors or warnings

## Visual Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Dashboard | <brand-logo> <brand-name>  [DASHBOARD]  [TRENDS*]    SETTINGS│
└──────────────────────────────────────────────────────────────────────────┘

Historical Trends
Weekly performance · Mar 30 – Apr 26 (4 weeks)

                                 [Monthly | Weekly*]  📅 Mar 30 – Apr 26  All Brands ▾

┌── METRICS ───────────────────────────────────────────────────────────────┐
│ FRONTEND:  [Ad Spend]  [CPL*]                                           │
│ MIDEND:    [Respond Rate]  [Appt Rate]  [Show Up Rate]                  │
│ BACKEND:   [Sales*]  [Orders]  [Conv Rate*]  [AOV]  [CPA%]              │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   Line chart — 4 weekly points.                                          │
│   Mar 30–Apr 5 ●   Apr 6–12 ●   Apr 13–19 ●   Apr 20–26 ⚪ (partial)    │
│   Tooltip on partial: "(incomplete) Apr 20 – 26 · CPL: RM 245"          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Legend: `*` = active selection. `●` = solid filled dot. `⚪` = hollow ring dot (partial).

## Files to Modify

| File | Change Type | Approx Lines |
|------|-------------|--------------|
| `lib/dates.ts` | Extend | +70 |
| `lib/trends.ts` | Refactor | ±80 |
| `lib/__tests__/dates.test.ts` | New | +120 |
| `lib/__tests__/trends.test.ts` | Extend | +80 |
| `app/[clientId]/trends/page.tsx` | Modify | ±15 |
| `app/[clientId]/trends/trends-client.tsx` | Modify | ±40 |
| `components/trends/trend-chart.tsx` | Modify | ±30 |
| `components/trends/granularity-toggle.tsx` | New | +40 |
| `components/dashboard/date-range-picker.tsx` | Extend | +25 |

**Total:** ~500 lines, roughly 2–3 days of implementation at normal pace.

## Rollout Strategy

- **Branch:** `feat/trends-weekly-historical` (this spec lives here from the start)
- **Vercel preview:** auto-generated on first push of this branch
- **Review flow:**
  1. Implement against this spec using TDD (write failing test → implement → green)
  2. Verify locally with `npm run dev` + `npx vitest run`
  3. Push to branch → Vercel generates preview URL
  4. Manual smoke test on preview URL (10-item checklist above)
  5. Open PR to `main`
  6. Merge after preview validation → Vercel auto-deploys production

No production traffic is affected until the merge-to-main step. Clients continue to see the current Monthly-only trend view throughout development.

## Out of Scope

- Daily / Quarterly / Yearly granularity
- Comparison series on Trends (e.g., "Weekly this year vs last year")
- Dashed last-segment line rendering
- Exporting trends as PDF / image
- Persisting granularity/range as per-user-per-project preference (Supabase-backed)

## Future Follow-ups

Documented here so they don't get lost when implementation ships:

- **Delete `fetchMonthlyTrends` + `MonthlyTrendPoint` alias** after grep confirms zero external consumers post-merge
- **Fix CONTINUE.md** path reference — currently points to `/Users/khoweijie/Documents/funnel-dashboard`, actual is `/Users/khoweijie/Claude/Project/funnel-dashboard`
- **Update memory file** `project_dashboard_saas.md` — 16 days stale; many features have landed since (Projects rename, RBAC, daily ad spend sync)
- **Evaluate dashed-line rendering** for partial segment if Recharts ships per-segment stroke support, or migrate to Visx/D3 if multiple chart customization needs accumulate
