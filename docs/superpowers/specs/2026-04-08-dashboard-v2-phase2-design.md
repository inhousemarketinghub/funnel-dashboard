# Funnel Dashboard v2 — Phase 2 Design Spec

> Client Experience: HeroCard Grouping + Historical Trends Page

## Context

Phase 1 (management foundation) is complete. Phase 2 addresses the core user pain point: **clients can't intuitively understand the dashboard data**. Specifically:
- They can't tell at a glance if performance is good or bad
- They don't know which funnel stage has problems
- They can't judge if ad spend is efficient

The fix is twofold:
1. Group existing HeroCards into meaningful stages (Frontend/Midend/Backend) so clients understand the funnel flow
2. Add a historical trends page so clients can see month-over-month patterns

## Module 1: HeroCard Grouping

### What Changes

The existing 10 HeroCards keep their current appearance, animations, and expandable details. The only change is **adding section headers** that group them into 3 stages.

### Grouping

| Group | Label | Cards | Grid |
|-------|-------|-------|------|
| **Frontend** | "FRONTEND — Ad Performance" | Total Ad Spend, CPL | 2 cards in a row |
| **Midend** | "MIDEND — Lead Pipeline" | Respond Rate, Appointment Rate, Show Up Rate | 3 cards in a row |
| **Backend** | "BACKEND — Revenue" | Total Sales, Orders, Conv Rate, AOV, CPA% | 5 cards in a row (wraps to 3+2 on smaller screens) |

### Section Header Design

Each group gets a small label above the cards:
- Font: `font-label`, 10px, uppercase, tracking-widest
- Color: `var(--t4)` (muted)
- Left-aligned
- Small bottom margin (8px) before the card grid
- Optional: thin top border to visually separate groups (1px `var(--border)`)

### Walk-in Funnel Variant

Walk-in funnel has 8 cards instead of 10 (no Appointment Rate, no Show Up Rate). Grouping:

| Group | Cards |
|-------|-------|
| **Frontend** | Total Ad Spend, CPL |
| **Midend** | Respond Rate (Visit Rate) |
| **Backend** | Total Sales, Orders, Conv Rate, AOV, CPA% |

### Files to Modify

- `components/dashboard/hero-cards.tsx` — Restructure card array into 3 groups, render section headers between groups
- `app/[clientId]/page.tsx` — Minor: may need to adjust the Stagger wrapper around HeroCards

### What Does NOT Change

- Individual card appearance, layout, colors, fonts
- CountUp animations, achievement badges, expandable details
- Summary Cards, FunnelFlow, MoMTable, KPIChart, PersonPerformance — all unchanged

## Module 2: Historical Trends Page

### Route

`/[clientId]/trends` — new page accessible via a "Trends" tab in the dashboard header.

### Navigation

Add a tab/link in the existing dashboard layout (`app/[clientId]/layout.tsx`):
- Current: client name + settings + theme toggle + logout
- New: add "Dashboard" and "Trends" tabs next to the client name
- Active tab gets `border-bottom: 2px solid var(--blue)` + `color: var(--blue)`

### Page Layout

```
┌─ Header: same as dashboard (client name, nav tabs) ──────┐
│                                                           │
│  ┌─ Metric Selector ──────────────────────────────────┐  │
│  │ [x] Total Sales  [x] CPL  [x] Conv Rate  [ ] AOV  │  │
│  │ [ ] Ad Spend     [ ] ROAS  [ ] Appt Rate  ...      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─ Line Chart (Recharts) ────────────────────────────┐  │
│  │                                                     │  │
│  │  Y-Left (RM)                        Y-Right (%)    │  │
│  │  │                                          │      │  │
│  │  │     ___                                  │      │  │
│  │  │    /   \___                              │      │  │
│  │  │___/        \___                          │      │  │
│  │  │                                          │      │  │
│  │  └──────────────────────────────────────────┘      │  │
│  │    Nov   Dec   Jan   Feb   Mar   Apr               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─ Month Range Selector ─────────────────────────────┐  │
│  │  Last 6 months │ Last 12 months │ Custom            │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### Metric Selector

Checkboxes organized in 3 groups (matching HeroCard groups):

| Group | Metrics |
|-------|---------|
| Frontend | Total Ad Spend, CPL |
| Midend | Respond Rate, Appointment Rate, Show Up Rate |
| Backend | Total Sales, Orders, Conv Rate, AOV, CPA% |

- Default selected: Total Sales, CPL, Conv Rate
- Max selectable: 5 (to keep chart readable)
- Each metric gets a unique line color from a predefined palette

### Chart Configuration

- **Library:** Recharts (already installed, v3.8.1)
- **Type:** `<LineChart>` with `<Line>` per selected metric
- **Dual Y-axis:**
  - Left axis: currency values (RM) — for Sales, Ad Spend, CPL, AOV
  - Right axis: percentage/ratio values — for rates, CPA%, ROAS
- **X-axis:** Month labels (e.g., "Nov 2025", "Dec 2025", ...)
- **Tooltip:** On hover, show all selected metrics for that month
- **Legend:** Below chart, showing metric name + color + current value
- **Animation:** Lines draw in from left on mount (Recharts built-in)
- **Responsive:** Chart fills container width, min-height 300px

### Month Range

- **Default:** Last 6 months
- **Options:** "Last 6 months" | "Last 12 months" | Custom (date pickers)
- Pill-style toggle buttons

### Data Fetching

New server function `fetchMonthlyTrends(sheetId: string, months: number)`:
1. Calculate date ranges for each of the last N months
2. For each month, call `fetchPerformanceData(sheetId, monthStart, monthEnd)`
3. Compute metrics via `computeMetrics()` for each month
4. Return `{ month: string, metrics: FunnelMetrics }[]`

This is called once on page load as a Server Component, then passed to the client-side chart component.

### New Files

```
app/[clientId]/trends/page.tsx         — Server Component: fetch data, render layout
components/trends/trend-chart.tsx      — Client Component: Recharts line chart
components/trends/metric-selector.tsx  — Client Component: checkbox grid
lib/trends.ts                          — fetchMonthlyTrends() data fetching
```

### Modified Files

```
app/[clientId]/layout.tsx              — Add Dashboard/Trends tab navigation
```

## Design System Compliance

All new components follow DESIGN.md:
- Colors: Stone palette + Amber accent. Chart line colors from a curated set (no neon)
- Typography: Geist Mono for numbers/axes, DM Sans for labels
- Motion: Chart lines animate in, metric selector has transition on toggle
- Responsive: Chart stacks cleanly on mobile, metric selector wraps to 2 columns
- No emoji in UI chrome

## Testing Strategy

- Unit test for `fetchMonthlyTrends()` — mock sheets data, verify monthly aggregation
- Existing 34 tests must continue passing
- Manual verification: check chart renders with real client data
