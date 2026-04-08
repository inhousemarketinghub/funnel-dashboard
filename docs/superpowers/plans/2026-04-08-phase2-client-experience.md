# Phase 2: Client Experience — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group HeroCards into Frontend/Midend/Backend sections and add a historical trends page with user-selectable multi-metric line chart.

**Architecture:** Modify HeroCards to render in 3 labeled groups instead of a flat list. Add a new `/[clientId]/trends` route with Recharts `LineChart`, dual Y-axis, and checkbox metric selector. Data fetching for trends reuses existing `fetchPerformanceData` + `computeMetrics` per month.

**Tech Stack:** Next.js 16 (App Router), React 19, Recharts 3.8.1, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-04-08-dashboard-v2-phase2-design.md`

---

## File Structure

### Modified Files
```
components/dashboard/hero-cards.tsx   — Restructure cards into 3 groups with section labels
app/[clientId]/page.tsx               — Adjust Stagger wrapper for grouped HeroCards
app/[clientId]/layout.tsx             — Add Dashboard/Trends tab navigation
```

### New Files
```
lib/trends.ts                         — fetchMonthlyTrends() data fetching
components/trends/metric-selector.tsx  — Checkbox grid for selecting chart metrics
components/trends/trend-chart.tsx      — Recharts LineChart with dual Y-axis
app/[clientId]/trends/page.tsx         — Trends page (Server Component)
```

---

## Task 1: Restructure HeroCards into Groups

**Files:**
- Modify: `components/dashboard/hero-cards.tsx`
- Modify: `app/[clientId]/page.tsx`

- [ ] **Step 1: Restructure HeroCards to render 3 groups**

In `components/dashboard/hero-cards.tsx`, change the component to render cards in 3 labeled sections instead of a flat list.

The current code defines a `cards: CardDef[]` array (10 items for appointment, 8 for walk-in) and renders them all in a single `<>cards.map()</>`.

Change to: define 3 separate arrays, then render each with a section label.

For **appointment** funnel, split the existing cards array into:

```typescript
const frontend: CardDef[] = [
  cards[1], // Total Ad Spend (currently index 1 in Row 1)
  cards[5], // CPL (currently index 0 in Row 2)
];
const midend: CardDef[] = [
  cards[6], // Respond Rate
  cards[7], // Appointment Rate
  cards[8], // Show Up Rate
];
const backend: CardDef[] = [
  cards[0], // Total Sales
  cards[3], // Orders
  cards[9], // Conversion Rate
  cards[4], // AOV
  cards[2], // CPA%
];
```

For **walk-in** funnel:
```typescript
const frontend: CardDef[] = [
  cards[1], // Total Ad Spend
  cards[4], // CPL
];
const midend: CardDef[] = [
  cards[5], // Visit Rate
];
const backend: CardDef[] = [
  cards[0], // Total Sales
  cards[3], // Orders
  cards[6], // Conversion Rate
  cards[7], // AOV
  cards[2], // CPA%
];
```

Replace the return JSX. Instead of:
```tsx
return (
  <>
    {cards.map((card, i) => (
      <KPICard key={card.label} card={card} accent={ACCENT_COLORS[i]} />
    ))}
  </>
);
```

Change to a function that renders a group:
```tsx
function renderGroup(label: string, groupCards: CardDef[], startIndex: number) {
  return (
    <div key={label}>
      <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-2 mt-4 first:mt-0">
        {label}
      </div>
      <div className={`grid grid-cols-2 md:grid-cols-3 ${groupCards.length <= 3 ? `lg:grid-cols-${groupCards.length}` : "lg:grid-cols-5"} gap-[10px]`}>
        {groupCards.map((card, i) => (
          <KPICard key={card.label} card={card} accent={ACCENT_COLORS[startIndex + i]} />
        ))}
      </div>
    </div>
  );
}
```

Then return:
```tsx
return (
  <div className="space-y-2">
    {renderGroup("FRONTEND — Ad Performance", frontend, 0)}
    {renderGroup("MIDEND — Lead Pipeline", midend, frontend.length)}
    {renderGroup("BACKEND — Revenue", backend, frontend.length + midend.length)}
  </div>
);
```

- [ ] **Step 2: Update page.tsx Stagger wrapper**

In `app/[clientId]/page.tsx`, the current code wraps HeroCards in a Stagger with grid classes:

```tsx
<Stagger className={`grid grid-cols-2 md:grid-cols-3 ${...} gap-[10px] mb-[10px]`} staggerMs={50}>
  <HeroCards ... />
</Stagger>
```

Since HeroCards now manages its own grid layout internally, simplify the wrapper:

```tsx
<Stagger staggerMs={50} className="mb-[10px]">
  <HeroCards ... />
</Stagger>
```

Remove the grid classes from the Stagger — HeroCards handles its own grid per group.

- [ ] **Step 3: Run type check and tests**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard-phase1 && npx tsc --noEmit && npx vitest run`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/hero-cards.tsx app/[clientId]/page.tsx
git commit -m "feat: group HeroCards into Frontend/Midend/Backend sections"
```

---

## Task 2: Trends Data Fetching

**Files:**
- Create: `lib/trends.ts`
- Test: `lib/__tests__/trends.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/__tests__/trends.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getMonthRanges } from "../trends";

describe("getMonthRanges", () => {
  it("returns correct ranges for 3 months back from April 2026", () => {
    const ranges = getMonthRanges(3, new Date(2026, 3, 8)); // April 8, 2026
    expect(ranges).toHaveLength(3);
    // Feb, Mar, Apr
    expect(ranges[0].label).toBe("Feb 2026");
    expect(ranges[0].from.getMonth()).toBe(1); // Feb
    expect(ranges[0].to.getMonth()).toBe(1);

    expect(ranges[1].label).toBe("Mar 2026");
    expect(ranges[2].label).toBe("Apr 2026");
    // Apr range should end at today, not month end
    expect(ranges[2].to.getDate()).toBe(8);
  });

  it("returns 6 ranges for 6 months", () => {
    const ranges = getMonthRanges(6, new Date(2026, 3, 15));
    expect(ranges).toHaveLength(6);
    expect(ranges[0].label).toBe("Nov 2025");
    expect(ranges[5].label).toBe("Apr 2026");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard-phase1 && npx vitest run lib/__tests__/trends.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create lib/trends.ts**

```typescript
import { fetchPerformanceData } from "./sheets";
import { computeMetrics } from "./metrics";
import type { FunnelMetrics } from "./types";

export interface MonthRange {
  label: string;
  from: Date;
  to: Date;
}

export interface MonthlyTrendPoint {
  month: string;
  metrics: FunnelMetrics;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getMonthRanges(count: number, now: Date = new Date()): MonthRange[] {
  const ranges: MonthRange[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const label = `${MONTH_NAMES[month]} ${year}`;
    const from = new Date(year, month, 1);
    const to = i === 0 ? now : new Date(year, month + 1, 0); // current month: up to today; past: full month
    ranges.push({ label, from, to });
  }
  return ranges;
}

export async function fetchMonthlyTrends(
  sheetId: string,
  months: number = 6,
  brandName: string | null = null,
): Promise<MonthlyTrendPoint[]> {
  const ranges = getMonthRanges(months);
  const results: MonthlyTrendPoint[] = [];

  for (const range of ranges) {
    try {
      const rows = await fetchPerformanceData(sheetId, range.from, range.to, brandName);
      const metrics = computeMetrics(rows, 0);
      results.push({ month: range.label, metrics });
    } catch {
      // If a month fails, push zeroed metrics
      results.push({
        month: range.label,
        metrics: {
          ad_spend: 0, inquiry: 0, contact: 0, appointment: 0, showup: 0,
          est_showup: 0, orders: 0, sales: 0, cpl: 0, respond_rate: 0,
          appt_rate: 0, showup_rate: 0, conv_rate: 0, aov: 0, roas: 0, cpa_pct: 0,
        },
      });
    }
  }

  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard-phase1 && npx vitest run lib/__tests__/trends.test.ts`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/trends.ts lib/__tests__/trends.test.ts
git commit -m "feat: add trends data fetching with monthly aggregation"
```

---

## Task 3: Metric Selector Component

**Files:**
- Create: `components/trends/metric-selector.tsx`

- [ ] **Step 1: Create the metric selector component**

Create `components/trends/metric-selector.tsx`:

```tsx
"use client";

export interface MetricOption {
  key: string;
  label: string;
  group: "frontend" | "midend" | "backend";
  unit: "currency" | "percent" | "number" | "multiplier";
  color: string;
}

export const METRIC_OPTIONS: MetricOption[] = [
  // Frontend
  { key: "ad_spend", label: "Ad Spend", group: "frontend", unit: "currency", color: "#1B4F9B" },
  { key: "cpl", label: "CPL", group: "frontend", unit: "currency", color: "#6366F1" },
  // Midend
  { key: "respond_rate", label: "Respond Rate", group: "midend", unit: "percent", color: "#D97706" },
  { key: "appt_rate", label: "Appt Rate", group: "midend", unit: "percent", color: "#EA580C" },
  { key: "showup_rate", label: "Show Up Rate", group: "midend", unit: "percent", color: "#DC2626" },
  // Backend
  { key: "sales", label: "Total Sales", group: "backend", unit: "currency", color: "#16A34A" },
  { key: "orders", label: "Orders", group: "backend", unit: "number", color: "#0D9488" },
  { key: "conv_rate", label: "Conv Rate", group: "backend", unit: "percent", color: "#7C3AED" },
  { key: "aov", label: "AOV", group: "backend", unit: "currency", color: "#BE185D" },
  { key: "cpa_pct", label: "CPA%", group: "backend", unit: "percent", color: "#78716C" },
];

const GROUP_LABELS = {
  frontend: "Frontend",
  midend: "Midend",
  backend: "Backend",
};

interface Props {
  selected: string[];
  onChange: (keys: string[]) => void;
  maxSelect?: number;
}

export function MetricSelector({ selected, onChange, maxSelect = 5 }: Props) {
  function toggle(key: string) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else if (selected.length < maxSelect) {
      onChange([...selected, key]);
    }
  }

  const groups = ["frontend", "midend", "backend"] as const;

  return (
    <div className="card-base mb-4" style={{ padding: "14px 16px" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-label text-[11px] uppercase tracking-widest text-[var(--t4)]">
          Select Metrics
        </span>
        <span className="text-[11px] text-[var(--t4)]">
          {selected.length}/{maxSelect} selected
        </span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {groups.map((group) => (
          <div key={group}>
            <div className="text-[9px] uppercase tracking-wider text-[var(--t4)] mb-1.5 font-label">
              {GROUP_LABELS[group]}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {METRIC_OPTIONS.filter((m) => m.group === group).map((m) => {
                const isSelected = selected.includes(m.key);
                const atMax = !isSelected && selected.length >= maxSelect;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggle(m.key)}
                    disabled={atMax}
                    className="px-2.5 py-1 rounded-md text-[11px] border transition-all duration-150"
                    style={{
                      background: isSelected ? m.color : "transparent",
                      color: isSelected ? "white" : atMax ? "var(--t4)" : "var(--t2)",
                      borderColor: isSelected ? m.color : "var(--border)",
                      opacity: atMax ? 0.4 : 1,
                      cursor: atMax ? "not-allowed" : "pointer",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard-phase1 && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/trends/metric-selector.tsx
git commit -m "feat: add metric selector component for trends page"
```

---

## Task 4: Trend Chart Component

**Files:**
- Create: `components/trends/trend-chart.tsx`

- [ ] **Step 1: Create the Recharts line chart component**

Create `components/trends/trend-chart.tsx`:

```tsx
"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyTrendPoint } from "@/lib/trends";
import { METRIC_OPTIONS } from "./metric-selector";
import type { FunnelMetrics } from "@/lib/types";

interface Props {
  data: MonthlyTrendPoint[];
  selectedMetrics: string[];
}

function isCurrencyOrNumber(unit: string): boolean {
  return unit === "currency" || unit === "number";
}

function formatValue(value: number, unit: string): string {
  if (unit === "currency") {
    if (value >= 1000) return `RM ${(value / 1000).toFixed(0)}K`;
    return `RM ${value.toFixed(0)}`;
  }
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "multiplier") return `${value.toFixed(1)}x`;
  return value.toFixed(0);
}

export function TrendChart({ data, selectedMetrics }: Props) {
  const options = METRIC_OPTIONS.filter((m) => selectedMetrics.includes(m.key));
  const hasLeft = options.some((m) => isCurrencyOrNumber(m.unit));
  const hasRight = options.some((m) => !isCurrencyOrNumber(m.unit));

  const chartData = data.map((point) => {
    const entry: Record<string, string | number> = { month: point.month };
    for (const opt of options) {
      entry[opt.key] = (point.metrics as Record<string, number>)[opt.key] ?? 0;
    }
    return entry;
  });

  if (selectedMetrics.length === 0) {
    return (
      <div className="card-base flex items-center justify-center" style={{ minHeight: 300, padding: 20 }}>
        <p className="text-[var(--t4)] text-[13px]">Select at least one metric to display the chart.</p>
      </div>
    );
  }

  return (
    <div className="card-base" style={{ padding: "16px 12px 12px" }}>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "var(--t4)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          {hasLeft && (
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: "var(--t4)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))}
            />
          )}
          {hasRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: "var(--t4)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
          )}
          <Tooltip
            contentStyle={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            formatter={(value: number, name: string) => {
              const opt = METRIC_OPTIONS.find((m) => m.key === name);
              return [formatValue(value, opt?.unit || "number"), opt?.label || name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) => {
              const opt = METRIC_OPTIONS.find((m) => m.key === value);
              return opt?.label || value;
            }}
          />
          {options.map((opt) => (
            <Line
              key={opt.key}
              yAxisId={isCurrencyOrNumber(opt.unit) ? "left" : "right"}
              type="monotone"
              dataKey={opt.key}
              stroke={opt.color}
              strokeWidth={2}
              dot={{ r: 3, fill: opt.color }}
              activeDot={{ r: 5 }}
              animationDuration={800}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard-phase1 && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/trends/trend-chart.tsx
git commit -m "feat: add trend chart component with dual Y-axis and Recharts"
```

---

## Task 5: Trends Page + Layout Navigation

**Files:**
- Create: `app/[clientId]/trends/page.tsx`
- Modify: `app/[clientId]/layout.tsx`

- [ ] **Step 1: Create the trends page**

Create `app/[clientId]/trends/page.tsx`:

```tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchMonthlyTrends } from "@/lib/trends";
import { TrendsClient } from "./trends-client";

export default async function TrendsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) return <p className="text-[var(--t4)] p-8">Client not found</p>;

  const data = await fetchMonthlyTrends(client.sheet_id, 6, null);

  return <TrendsClient data={data} clientName={client.name} />;
}
```

- [ ] **Step 2: Create the trends client wrapper**

Create `app/[clientId]/trends/trends-client.tsx`:

```tsx
"use client";
import { useState } from "react";
import { TrendChart } from "@/components/trends/trend-chart";
import { MetricSelector } from "@/components/trends/metric-selector";
import type { MonthlyTrendPoint } from "@/lib/trends";

interface Props {
  data: MonthlyTrendPoint[];
  clientName: string;
}

const RANGE_OPTIONS = [
  { label: "6 months", value: 6 },
  { label: "12 months", value: 12 },
];

export function TrendsClient({ data, clientName }: Props) {
  const [selected, setSelected] = useState(["sales", "cpl", "conv_rate"]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-heading text-[22px] font-semibold text-[var(--t1)]">
          Historical Trends
        </h2>
        <p className="text-[13px] text-[var(--t3)] mt-1">
          Month-over-month performance for {clientName}
        </p>
      </div>

      <MetricSelector selected={selected} onChange={setSelected} />
      <TrendChart data={data} selectedMetrics={selected} />
    </div>
  );
}
```

- [ ] **Step 3: Add Dashboard/Trends tabs to layout**

In `app/[clientId]/layout.tsx`, add navigation tabs. After the client name span, add:

```tsx
<div className="flex items-center gap-1 ml-4">
  <Link
    href={`/${clientId}`}
    className="text-[12px] px-2.5 py-1 rounded-md transition-colors"
    style={{
      color: "var(--t3)",
    }}
  >
    Dashboard
  </Link>
  <Link
    href={`/${clientId}/trends`}
    className="text-[12px] px-2.5 py-1 rounded-md transition-colors"
    style={{
      color: "var(--t3)",
    }}
  >
    Trends
  </Link>
</div>
```

Note: Active state highlighting requires knowing the current path. Since this is a Server Component, use a pattern from the codebase. Read the current URL from the layout's children context or use a simple approach: always show both links without active highlighting (the page content itself makes it clear which page you're on).

- [ ] **Step 4: Run type check and all tests**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard-phase1 && npx tsc --noEmit && npx vitest run`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add app/[clientId]/trends/ app/[clientId]/layout.tsx
git commit -m "feat: add historical trends page with line chart and metric selector"
```

---

## Task 6: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard-phase1 && npx vitest run`
Expected: All existing + new tests pass

- [ ] **Step 2: Run type check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard-phase1 && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 3: Manual smoke test**

Start: `cd /Users/khoweijie/Documents/funnel-dashboard-phase1 && npm run dev`

Test:
1. `/[clientId]` — HeroCards show in 3 groups (Frontend / Midend / Backend) with section labels
2. `/[clientId]/trends` — Line chart renders with 3 default metrics, metric selector works, max 5 selectable
3. Layout tabs: Dashboard and Trends links visible in topbar
4. Walk-in funnel client: verify Midend group only shows Visit Rate (1 card)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address Phase 2 integration issues"
```
