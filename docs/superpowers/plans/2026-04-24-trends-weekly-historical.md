# Trends Weekly Granularity + Historical Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Monthly/Weekly granularity toggle + arbitrary historical date range picker to the Trends page, with partial-period visual distinction via hollow-ring dots.

**Architecture:** Three-layer split. Data — `lib/dates.ts` (date math helpers) + `lib/trends.ts` (range generation + unified fetcher). Route — `app/[clientId]/trends/page.tsx` (URL → params → fetch). UI — `components/trends/*.tsx` + parameterized `components/dashboard/date-range-picker.tsx`. URL is single source of truth; snap-to-granularity enforced before URL write so refreshes are idempotent.

**Tech Stack:** TypeScript, Next.js 16.2.2, React 19, Recharts 3.8, vitest 4.1, react-day-picker 9.14, Tailwind v4, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-04-24-trends-weekly-historical-range-design.md`

**Branch:** `feat/trends-weekly-historical` (already created).

---

## Phase A — `lib/dates.ts` Foundations

All Phase A functions are pure, deterministic, and testable in isolation. Tests live in `lib/__tests__/dates.test.ts` (new file — does not exist yet).

### Task A1: Week-boundary helpers (`getMondayOf`, `getSundayOf`)

**Files:**
- Create: `lib/__tests__/dates.test.ts`
- Modify: `lib/dates.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/dates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getMondayOf, getSundayOf } from "../dates";

describe("getMondayOf", () => {
  it("returns same date when input is Monday", () => {
    const mon = new Date(2026, 3, 20); // Apr 20 2026 is a Monday
    const result = getMondayOf(mon);
    expect(result.getTime()).toBe(mon.getTime());
  });

  it("returns previous Monday when input is mid-week", () => {
    const wed = new Date(2026, 3, 22); // Apr 22 2026 is a Wednesday
    const result = getMondayOf(wed);
    expect(result).toEqual(new Date(2026, 3, 20));
  });

  it("returns previous Monday when input is Sunday", () => {
    const sun = new Date(2026, 3, 26); // Apr 26 2026 is a Sunday
    const result = getMondayOf(sun);
    expect(result).toEqual(new Date(2026, 3, 20));
  });

  it("handles year boundary: Jan 1 2026 (Thursday) → Dec 29 2025 (Monday)", () => {
    const jan1 = new Date(2026, 0, 1);
    const result = getMondayOf(jan1);
    expect(result).toEqual(new Date(2025, 11, 29));
  });
});

describe("getSundayOf", () => {
  it("returns same date when input is Sunday", () => {
    const sun = new Date(2026, 3, 26);
    const result = getSundayOf(sun);
    expect(result.getTime()).toBe(sun.getTime());
  });

  it("returns next Sunday when input is mid-week", () => {
    const wed = new Date(2026, 3, 22);
    const result = getSundayOf(wed);
    expect(result).toEqual(new Date(2026, 3, 26));
  });

  it("returns following Sunday when input is Monday", () => {
    const mon = new Date(2026, 3, 20);
    const result = getSundayOf(mon);
    expect(result).toEqual(new Date(2026, 3, 26));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/Claude/Project/funnel-dashboard && npx vitest run lib/__tests__/dates.test.ts
```

Expected: FAIL — "Cannot find module '../dates'" or "`getMondayOf` is not a function".

- [ ] **Step 3: Implement in `lib/dates.ts`**

Append to `lib/dates.ts` (after the existing `getPresetRange` function):

```ts
// ── Week boundary helpers ────────────────────────────────────────

export function getMondayOf(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  result.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

export function getSundayOf(d: Date): Date {
  const day = d.getDay();
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  result.setDate(d.getDate() + (day === 0 ? 0 : 7 - day));
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/Claude/Project/funnel-dashboard && npx vitest run lib/__tests__/dates.test.ts
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/dates.ts lib/__tests__/dates.test.ts
git commit -m "feat(dates): add getMondayOf/getSundayOf week boundary helpers"
```

---

### Task A2: `snapToGranularity`

**Files:**
- Modify: `lib/dates.ts`
- Modify: `lib/__tests__/dates.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/__tests__/dates.test.ts`:

```ts
import { snapToGranularity } from "../dates";

describe("snapToGranularity", () => {
  it("snaps weekly range to Mon-Sun boundaries", () => {
    const result = snapToGranularity(
      { from: new Date(2026, 3, 3), to: new Date(2026, 3, 20) },
      "weekly",
    );
    // Apr 3 (Fri) → previous Monday = Mar 30
    // Apr 20 (Mon) → following Sunday = Apr 26
    expect(result.from).toEqual(new Date(2026, 2, 30));
    expect(result.to).toEqual(new Date(2026, 3, 26));
  });

  it("leaves already-snapped weekly range unchanged", () => {
    const from = new Date(2026, 2, 30); // Monday
    const to = new Date(2026, 3, 26);   // Sunday
    const result = snapToGranularity({ from, to }, "weekly");
    expect(result.from).toEqual(from);
    expect(result.to).toEqual(to);
  });

  it("snaps monthly range to month start/end", () => {
    const result = snapToGranularity(
      { from: new Date(2025, 10, 15), to: new Date(2026, 3, 10) },
      "monthly",
    );
    expect(result.from).toEqual(new Date(2025, 10, 1));
    expect(result.to).toEqual(new Date(2026, 3, 30));
  });

  it("leaves already-snapped monthly range unchanged", () => {
    const from = new Date(2025, 10, 1);
    const to = new Date(2026, 3, 30);
    const result = snapToGranularity({ from, to }, "monthly");
    expect(result.from).toEqual(from);
    expect(result.to).toEqual(to);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/__tests__/dates.test.ts -t snapToGranularity
```

Expected: FAIL — "`snapToGranularity` is not exported".

- [ ] **Step 3: Implement**

Append to `lib/dates.ts`:

```ts
export type Granularity = "weekly" | "monthly";

export function snapToGranularity(
  range: DateRangeObj,
  granularity: Granularity,
): DateRangeObj {
  if (granularity === "weekly") {
    return {
      from: getMondayOf(range.from),
      to: getSundayOf(range.to),
    };
  }
  return {
    from: new Date(range.from.getFullYear(), range.from.getMonth(), 1),
    to: new Date(range.to.getFullYear(), range.to.getMonth() + 1, 0),
  };
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npx vitest run lib/__tests__/dates.test.ts
```

Expected: PASS — 11 tests total.

- [ ] **Step 5: Commit**

```bash
git add lib/dates.ts lib/__tests__/dates.test.ts
git commit -m "feat(dates): add snapToGranularity for Mon-Sun and month-boundary snapping"
```

---

### Task A3: `isPartialRange`

**Files:**
- Modify: `lib/dates.ts`
- Modify: `lib/__tests__/dates.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/__tests__/dates.test.ts`:

```ts
import { isPartialRange } from "../dates";

describe("isPartialRange", () => {
  const now = new Date(2026, 3, 24, 14, 30); // Apr 24 2026 2:30pm

  it("returns true when 'to' is in the future", () => {
    const future = new Date(2026, 3, 26); // Apr 26, after now
    expect(isPartialRange(future, now)).toBe(true);
  });

  it("returns false when 'to' is in the past", () => {
    const past = new Date(2026, 3, 20);
    expect(isPartialRange(past, now)).toBe(false);
  });

  it("returns false when 'to' equals now exactly", () => {
    expect(isPartialRange(now, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
npx vitest run lib/__tests__/dates.test.ts -t isPartialRange
```

Expected: FAIL — "isPartialRange is not exported".

- [ ] **Step 3: Implement**

Append to `lib/dates.ts`:

```ts
export function isPartialRange(to: Date, now: Date = new Date()): boolean {
  return to.getTime() > now.getTime();
}
```

- [ ] **Step 4: Verify**

```bash
npx vitest run lib/__tests__/dates.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dates.ts lib/__tests__/dates.test.ts
git commit -m "feat(dates): add isPartialRange for partial-period detection"
```

---

### Task A4: `formatWeekLabel`

**Files:**
- Modify: `lib/dates.ts`
- Modify: `lib/__tests__/dates.test.ts`

- [ ] **Step 1: Write failing tests**

Append:

```ts
import { formatWeekLabel } from "../dates";

describe("formatWeekLabel", () => {
  it("formats same-month week as 'Apr 14 – 20'", () => {
    const from = new Date(2026, 3, 14);
    const to = new Date(2026, 3, 20);
    expect(formatWeekLabel(from, to)).toBe("Apr 14 – 20");
  });

  it("formats cross-month week as 'Mar 30 – Apr 5'", () => {
    const from = new Date(2026, 2, 30);
    const to = new Date(2026, 3, 5);
    expect(formatWeekLabel(from, to)).toBe("Mar 30 – Apr 5");
  });

  it("formats year-boundary week as 'Dec 29 – Jan 4'", () => {
    const from = new Date(2025, 11, 29);
    const to = new Date(2026, 0, 4);
    expect(formatWeekLabel(from, to)).toBe("Dec 29 – Jan 4");
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
npx vitest run lib/__tests__/dates.test.ts -t formatWeekLabel
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `lib/dates.ts` (above or below existing `MONTH_NAMES` — note: `MONTH_NAMES` currently lives in `lib/trends.ts:16` — move it to `lib/dates.ts` as part of this task since it's a general-purpose constant, then re-import from trends.ts):

```ts
// at top of lib/dates.ts, exported
export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatWeekLabel(from: Date, to: Date): string {
  const EN_DASH = "–";
  const fromMonth = MONTH_NAMES[from.getMonth()];
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${fromMonth} ${from.getDate()} ${EN_DASH} ${to.getDate()}`;
  }
  const toMonth = MONTH_NAMES[to.getMonth()];
  return `${fromMonth} ${from.getDate()} ${EN_DASH} ${toMonth} ${to.getDate()}`;
}
```

Update `lib/trends.ts:16` to re-import instead of re-declare:

```ts
import { MONTH_NAMES } from "./dates";
// delete the local const MONTH_NAMES = [...];
```

- [ ] **Step 4: Verify**

```bash
npx vitest run
```

Expected: PASS for dates tests + existing trends tests still pass.

- [ ] **Step 5: Commit**

```bash
git add lib/dates.ts lib/trends.ts lib/__tests__/dates.test.ts
git commit -m "feat(dates): add formatWeekLabel + hoist MONTH_NAMES from trends.ts"
```

---

### Task A5: `getDefaultRange(granularity)`

**Files:**
- Modify: `lib/dates.ts`
- Modify: `lib/__tests__/dates.test.ts`

Note: the existing `getDefaultRange(): DateRangeObj` (dates.ts:45) takes no args and returns "current month to now". It's currently called by `resolveSearchParams` in dates.ts and by DateRangePicker. We'll overload by giving it an optional `granularity` parameter; calling without args keeps old behavior for existing callers.

- [ ] **Step 1: Write failing tests**

Append to `lib/__tests__/dates.test.ts`:

```ts
import { getDefaultRange } from "../dates";

describe("getDefaultRange(granularity)", () => {
  const now = new Date(2026, 3, 24); // Apr 24 2026, a Friday

  it("weekly: returns last 4 weeks ending this Sunday", () => {
    const result = getDefaultRange("weekly", now);
    // This week: Apr 20 (Mon) – Apr 26 (Sun)
    // Four weeks back: Mar 30 – Apr 26
    expect(result.from).toEqual(new Date(2026, 2, 30));
    expect(result.to).toEqual(new Date(2026, 3, 26));
  });

  it("monthly: returns last 6 months ending this month's last day", () => {
    const result = getDefaultRange("monthly", now);
    expect(result.from).toEqual(new Date(2025, 10, 1));
    expect(result.to).toEqual(new Date(2026, 3, 30));
  });

  it("no-arg form preserves existing behavior (current month to today)", () => {
    // Can't lock a hard equality without freezing time; just assert shape
    const result = getDefaultRange();
    expect(result.from.getDate()).toBe(1);
    expect(result.to.getTime()).toBeGreaterThanOrEqual(result.from.getTime());
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
npx vitest run lib/__tests__/dates.test.ts -t "getDefaultRange\\(granularity\\)"
```

Expected: FAIL — signature mismatch.

- [ ] **Step 3: Implement**

Replace `lib/dates.ts:45-51` (`getDefaultRange`) with overloaded version:

```ts
export function getDefaultRange(granularity?: Granularity, now: Date = new Date()): DateRangeObj {
  if (granularity === "weekly") {
    const thisSunday = getSundayOf(now);
    const fourWeeksAgoMonday = new Date(thisSunday);
    fourWeeksAgoMonday.setDate(thisSunday.getDate() - 27); // Sun - 27 days = Mon 4 weeks back
    return { from: fourWeeksAgoMonday, to: thisSunday };
  }
  if (granularity === "monthly") {
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from, to };
  }
  // Legacy behavior when no granularity passed — preserved for existing callers
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: now,
  };
}
```

- [ ] **Step 4: Verify all tests pass**

```bash
npx vitest run
```

Expected: PASS — all existing tests + new ones.

- [ ] **Step 5: Commit**

```bash
git add lib/dates.ts lib/__tests__/dates.test.ts
git commit -m "feat(dates): overload getDefaultRange to accept granularity"
```

---

### Task A6: New preset range handlers

**Files:**
- Modify: `lib/dates.ts`
- Modify: `lib/__tests__/dates.test.ts`

Extend `getPresetRange()` to handle the new Trends-page presets and export constant arrays.

- [ ] **Step 1: Write failing tests**

Append:

```ts
import { getPresetRange, MONTHLY_PRESETS, WEEKLY_PRESETS } from "../dates";

describe("Trends presets", () => {
  const now = new Date(2026, 3, 24); // Apr 24 2026 Fri

  it("MONTHLY_PRESETS exports expected labels", () => {
    expect(MONTHLY_PRESETS.map((p) => p.value)).toEqual([
      "last-3m", "last-6m", "last-12m", "ytd",
    ]);
  });

  it("WEEKLY_PRESETS exports expected labels", () => {
    expect(WEEKLY_PRESETS.map((p) => p.value)).toEqual([
      "last-4w", "last-8w", "last-12w", "last-26w",
    ]);
  });

  it("last-4w → Mar 30 – Apr 26 (when now=Apr 24 2026)", () => {
    const r = getPresetRange("last-4w", now);
    expect(r.from).toEqual(new Date(2026, 2, 30));
    expect(r.to).toEqual(new Date(2026, 3, 26));
  });

  it("last-12w → 12-week Mon-Sun range ending this Sunday", () => {
    const r = getPresetRange("last-12w", now);
    expect(r.to).toEqual(new Date(2026, 3, 26));
    // 12 weeks = 84 days; from should be 84 - 7 + 1 = 78 days before Sun... simpler: Monday 11 weeks before this Monday
    // this Monday = Apr 20; 11 weeks back = Feb 2
    expect(r.from).toEqual(new Date(2026, 1, 2));
  });

  it("last-6m → Nov 2025 – Apr 2026 (when now=Apr 24 2026)", () => {
    const r = getPresetRange("last-6m", now);
    expect(r.from).toEqual(new Date(2025, 10, 1));
    expect(r.to).toEqual(new Date(2026, 3, 30));
  });

  it("ytd → Jan 1 – current month end (when now=Apr 24 2026)", () => {
    const r = getPresetRange("ytd", now);
    expect(r.from).toEqual(new Date(2026, 0, 1));
    expect(r.to).toEqual(new Date(2026, 3, 30));
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
npx vitest run lib/__tests__/dates.test.ts -t "Trends presets"
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Modify `lib/dates.ts`:

First, extend `getPresetRange()` by adding cases. Locate lines 81–122 of current `lib/dates.ts`. Add optional `now` parameter and new cases BEFORE the `default` branch:

```ts
export function getPresetRange(preset: string, now: Date = new Date()): DateRangeObj {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    // ... keep all existing cases unchanged (this-week, last-week, this-month, last-month, last-7, last-30) ...

    case "last-4w":
    case "last-8w":
    case "last-12w":
    case "last-26w": {
      const weeks = preset === "last-4w" ? 4 : preset === "last-8w" ? 8 : preset === "last-12w" ? 12 : 26;
      const thisSunday = getSundayOf(today);
      const from = new Date(thisSunday);
      from.setDate(thisSunday.getDate() - (weeks * 7 - 1)); // 4w*7 = 28 days; inclusive range = 27 back to hit Monday
      return { from, to: thisSunday };
    }

    case "last-3m":
    case "last-6m":
    case "last-12m": {
      const months = preset === "last-3m" ? 3 : preset === "last-6m" ? 6 : 12;
      const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from, to };
    }

    case "ytd": {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from, to };
    }

    default:
      return getDefaultRange();
  }
}
```

Also append preset constant exports at the bottom of `lib/dates.ts`:

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

- [ ] **Step 4: Verify**

```bash
npx vitest run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dates.ts lib/__tests__/dates.test.ts
git commit -m "feat(dates): add MONTHLY_PRESETS/WEEKLY_PRESETS and preset range handlers"
```

---

## Phase B — `lib/trends.ts` Refactor

### Task B1: Types + `zeroMetrics` helper

**Files:**
- Modify: `lib/trends.ts`

- [ ] **Step 1: Add types and helper**

Replace the top of `lib/trends.ts` (lines 1–16 currently) with:

```ts
import { fetchPerformanceData } from "./sheets";
import { computeMetrics } from "./metrics";
import { MONTH_NAMES, isPartialRange, type Granularity } from "./dates";
import type { FunnelMetrics } from "./types";

// Re-export Granularity for consumers that import from trends.ts
export type { Granularity };

export interface TrendPoint {
  label: string;
  isPartial: boolean;
  metrics: FunnelMetrics;
}

export interface TrendRange {
  from: Date;
  to: Date;
  label: string;
  isPartial: boolean;
}

// Backward-compat alias — delete in follow-up after consumers migrate
export type MonthlyTrendPoint = TrendPoint;

function zeroMetrics(): FunnelMetrics {
  return {
    ad_spend: 0, inquiry: 0, contact: 0, appointment: 0, showup: 0,
    est_showup: 0, orders: 0, sales: 0, cpl: 0, respond_rate: 0,
    appt_rate: 0, showup_rate: 0, conv_rate: 0, aov: 0, roas: 0, cpa_pct: 0,
  };
}

// ... rest of existing file (MonthRange interface, getMonthRanges, fetchMonthlyTrends) remains for now
```

Remove the `MonthlyTrendPoint` interface declaration from its old location (trends.ts:11-14) since we now export it as an alias. Keep old `MonthRange` for now (Task B3 replaces it).

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If any consumer imports `MonthlyTrendPoint` it still works via alias.

- [ ] **Step 3: Replace inline zero-metrics literals**

Inside `fetchMonthlyTrends` (old function, trends.ts:43-58 and 66-73), replace both literal `{ ad_spend: 0, ... }` objects with `zeroMetrics()` calls.

- [ ] **Step 4: Run existing tests**

```bash
npx vitest run
```

Expected: PASS — existing `getMonthRanges` tests still green (this task didn't touch that function yet).

- [ ] **Step 5: Commit**

```bash
git add lib/trends.ts
git commit -m "refactor(trends): add TrendPoint/TrendRange types + zeroMetrics helper"
```

---

### Task B2: New `getWeekRanges(from, to)`

**Files:**
- Modify: `lib/trends.ts`
- Modify: `lib/__tests__/trends.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/__tests__/trends.test.ts`:

```ts
import { getWeekRanges } from "../trends";

describe("getWeekRanges", () => {
  const now = new Date(2026, 3, 24); // Apr 24 2026 Fri

  it("returns 4 ranges for Mar 30 – Apr 26", () => {
    const ranges = getWeekRanges(new Date(2026, 2, 30), new Date(2026, 3, 26), now);
    expect(ranges).toHaveLength(4);
    expect(ranges[0].from).toEqual(new Date(2026, 2, 30));
    expect(ranges[0].to).toEqual(new Date(2026, 3, 5));
    expect(ranges[0].label).toBe("Mar 30 – Apr 5");
    expect(ranges[3].from).toEqual(new Date(2026, 3, 20));
    expect(ranges[3].to).toEqual(new Date(2026, 3, 26));
    expect(ranges[3].label).toBe("Apr 20 – 26");
  });

  it("marks current week as partial when weekEnd > now", () => {
    const ranges = getWeekRanges(new Date(2026, 2, 30), new Date(2026, 3, 26), now);
    // Apr 20 – Apr 26 ends on Apr 26; now = Apr 24 → weekEnd > now → partial
    expect(ranges[3].isPartial).toBe(true);
    // Earlier weeks fully in the past
    expect(ranges[0].isPartial).toBe(false);
    expect(ranges[2].isPartial).toBe(false);
  });

  it("all weeks are complete for a historical range", () => {
    const ranges = getWeekRanges(
      new Date(2025, 6, 7),   // Mon Jul 7 2025
      new Date(2025, 7, 3),   // Sun Aug 3 2025
      now,
    );
    expect(ranges).toHaveLength(4);
    expect(ranges.every((r) => !r.isPartial)).toBe(true);
  });

  it("cross-year range produces correct labels", () => {
    const ranges = getWeekRanges(
      new Date(2025, 11, 29), // Mon Dec 29 2025
      new Date(2026, 0, 11),  // Sun Jan 11 2026
      now,
    );
    expect(ranges).toHaveLength(2);
    expect(ranges[0].label).toBe("Dec 29 – Jan 4");
    expect(ranges[1].label).toBe("Jan 5 – 11");
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
npx vitest run lib/__tests__/trends.test.ts -t getWeekRanges
```

Expected: FAIL — "getWeekRanges is not exported".

- [ ] **Step 3: Implement**

Append to `lib/trends.ts`:

```ts
import { formatWeekLabel } from "./dates";

export function getWeekRanges(from: Date, to: Date, now: Date = new Date()): TrendRange[] {
  const ranges: TrendRange[] = [];
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekStart.getDate() + 6);
    ranges.push({
      from: weekStart,
      to: weekEnd,
      label: formatWeekLabel(weekStart, weekEnd),
      isPartial: isPartialRange(weekEnd, now),
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return ranges;
}
```

- [ ] **Step 4: Verify**

```bash
npx vitest run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/trends.ts lib/__tests__/trends.test.ts
git commit -m "feat(trends): add getWeekRanges(from, to) with isPartial detection"
```

---

### Task B3: `getMonthRanges(from, to)` new signature + migrate tests

**Files:**
- Modify: `lib/trends.ts`
- Modify: `lib/__tests__/trends.test.ts`

- [ ] **Step 1: Rewrite existing test cases for new signature**

Replace the existing two `getMonthRanges` test blocks at the top of `lib/__tests__/trends.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { getMonthRanges } from "../trends";

describe("getMonthRanges(from, to)", () => {
  const now = new Date(2026, 3, 24);

  it("returns 3 ranges for Feb 1 – Apr 30 2026", () => {
    const ranges = getMonthRanges(
      new Date(2026, 1, 1),
      new Date(2026, 3, 30),
      now,
    );
    expect(ranges).toHaveLength(3);
    expect(ranges[0].label).toBe("Feb 2026");
    expect(ranges[0].from).toEqual(new Date(2026, 1, 1));
    expect(ranges[0].to).toEqual(new Date(2026, 1, 28));
    expect(ranges[2].label).toBe("Apr 2026");
    expect(ranges[2].from).toEqual(new Date(2026, 3, 1));
    expect(ranges[2].to).toEqual(new Date(2026, 3, 30));
  });

  it("returns 6 ranges for Nov 1 2025 – Apr 30 2026", () => {
    const ranges = getMonthRanges(
      new Date(2025, 10, 1),
      new Date(2026, 3, 30),
      now,
    );
    expect(ranges).toHaveLength(6);
    expect(ranges[0].label).toBe("Nov 2025");
    expect(ranges[5].label).toBe("Apr 2026");
  });

  it("marks current month as partial when monthEnd > now", () => {
    const ranges = getMonthRanges(
      new Date(2025, 10, 1),
      new Date(2026, 3, 30),
      now,
    );
    expect(ranges[5].isPartial).toBe(true);
    expect(ranges[4].isPartial).toBe(false);
  });

  it("all months complete for historical range", () => {
    const ranges = getMonthRanges(
      new Date(2024, 0, 1),
      new Date(2024, 5, 30),
      now,
    );
    expect(ranges).toHaveLength(6);
    expect(ranges.every((r) => !r.isPartial)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests (they'll fail — old signature)**

```bash
npx vitest run lib/__tests__/trends.test.ts -t "getMonthRanges\\(from, to\\)"
```

Expected: FAIL — existing `getMonthRanges(count, now)` signature can't accept two Dates.

- [ ] **Step 3: Rewrite `getMonthRanges` in `lib/trends.ts`**

Replace the current `getMonthRanges` function (trends.ts:18-30) with:

```ts
export function getMonthRanges(from: Date, to: Date, now: Date = new Date()): TrendRange[] {
  const ranges: TrendRange[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const endCursor = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor.getTime() <= endCursor.getTime()) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const label = `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
    ranges.push({
      from: monthStart,
      to: monthEnd,
      label,
      isPartial: isPartialRange(monthEnd, now),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ranges;
}
```

Also delete the old `MonthRange` interface at trends.ts:5-9 — `TrendRange` (from Task B1) replaces it.

- [ ] **Step 4: Update `fetchMonthlyTrends` to use new signature**

In the existing `fetchMonthlyTrends` (trends.ts:32-77), replace the call `getMonthRanges(months)` with the equivalent using new signature:

```ts
export async function fetchMonthlyTrends(
  sheetId: string,
  months: number = 6,
  brandName: string | null = null,
): Promise<TrendPoint[]> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const ranges = getMonthRanges(from, to, now);
  const results: TrendPoint[] = [];

  let allData: import("./types").DailyMetric[] = [];
  try {
    const perfResult = await fetchPerformanceData(sheetId, brandName ?? undefined);
    allData = perfResult.data;
  } catch {
    for (const range of ranges) {
      results.push({ label: range.label, isPartial: range.isPartial, metrics: zeroMetrics() });
    }
    return results;
  }

  for (const range of ranges) {
    try {
      const rows = allData.filter((r) => r.date >= range.from && r.date <= range.to);
      const metrics = computeMetrics(rows, 0);
      results.push({ label: range.label, isPartial: range.isPartial, metrics });
    } catch {
      results.push({ label: range.label, isPartial: range.isPartial, metrics: zeroMetrics() });
    }
  }
  return results;
}
```

Note: return type changes to `TrendPoint[]` (was `MonthlyTrendPoint[]`, which is now aliased to TrendPoint — so it still works for consumers). The `month` field is renamed `label`.

- [ ] **Step 5: Verify all tests pass**

```bash
npx vitest run
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/trends.ts lib/__tests__/trends.test.ts
git commit -m "refactor(trends): change getMonthRanges to (from, to) signature + emit TrendRange"
```

---

### Task B4: `fetchTrends` unified fetcher

**Files:**
- Modify: `lib/trends.ts`
- Modify: `lib/__tests__/trends.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/__tests__/trends.test.ts`:

```ts
import { fetchTrends } from "../trends";
import { vi } from "vitest";

// Mock fetchPerformanceData so we don't hit Google Sheets
vi.mock("../sheets", () => ({
  fetchPerformanceData: vi.fn(),
}));

import { fetchPerformanceData } from "../sheets";

describe("fetchTrends", () => {
  const now = new Date(2026, 3, 24);

  beforeEach(() => {
    vi.mocked(fetchPerformanceData).mockReset();
  });

  it("weekly: returns 4 TrendPoints for 4-week range", async () => {
    vi.mocked(fetchPerformanceData).mockResolvedValue({
      data: [
        { date: new Date(2026, 3, 1), ad_spend: 100, inquiry: 10, contact: 5, appointment: 3, showup: 2, est_showup: 2, orders: 1, sales: 500 } as any,
        { date: new Date(2026, 3, 15), ad_spend: 200, inquiry: 20, contact: 10, appointment: 6, showup: 4, est_showup: 4, orders: 2, sales: 1000 } as any,
      ],
      headers: [],
    } as any);

    const points = await fetchTrends({
      sheetId: "fake",
      granularity: "weekly",
      from: new Date(2026, 2, 30),
      to: new Date(2026, 3, 26),
      now,
    });

    expect(points).toHaveLength(4);
    expect(points[0].label).toBe("Mar 30 – Apr 5");
    expect(points[0].metrics.ad_spend).toBe(100);
    expect(points[2].metrics.ad_spend).toBe(200); // Apr 15 falls in Apr 13-19 range
    expect(points[3].isPartial).toBe(true);
  });

  it("monthly: returns TrendPoints labeled by month", async () => {
    vi.mocked(fetchPerformanceData).mockResolvedValue({ data: [], headers: [] } as any);

    const points = await fetchTrends({
      sheetId: "fake",
      granularity: "monthly",
      from: new Date(2026, 1, 1),
      to: new Date(2026, 3, 30),
      now,
    });

    expect(points).toHaveLength(3);
    expect(points.map((p) => p.label)).toEqual(["Feb 2026", "Mar 2026", "Apr 2026"]);
    expect(points.every((p) => p.metrics.ad_spend === 0)).toBe(true); // empty data
  });

  it("returns zero metrics for all ranges when fetch throws", async () => {
    vi.mocked(fetchPerformanceData).mockRejectedValue(new Error("boom"));

    const points = await fetchTrends({
      sheetId: "fake",
      granularity: "weekly",
      from: new Date(2026, 2, 30),
      to: new Date(2026, 3, 26),
      now,
    });

    expect(points).toHaveLength(4);
    expect(points.every((p) => p.metrics.ad_spend === 0)).toBe(true);
  });
});
```

Also add `beforeEach` to the imports at the top of the test file:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
```

- [ ] **Step 2: Run to fail**

```bash
npx vitest run lib/__tests__/trends.test.ts -t fetchTrends
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `lib/trends.ts`:

```ts
export async function fetchTrends(opts: {
  sheetId: string;
  granularity: Granularity;
  from: Date;
  to: Date;
  brandName?: string | null;
  now?: Date;
}): Promise<TrendPoint[]> {
  const now = opts.now ?? new Date();
  const ranges = opts.granularity === "weekly"
    ? getWeekRanges(opts.from, opts.to, now)
    : getMonthRanges(opts.from, opts.to, now);

  const results: TrendPoint[] = [];
  let allData: import("./types").DailyMetric[] = [];
  try {
    const perfResult = await fetchPerformanceData(opts.sheetId, opts.brandName ?? undefined);
    allData = perfResult.data;
  } catch (err) {
    console.error("fetchTrends: fetchPerformanceData failed", err);
    for (const range of ranges) {
      results.push({ label: range.label, isPartial: range.isPartial, metrics: zeroMetrics() });
    }
    return results;
  }

  for (const range of ranges) {
    try {
      const rows = allData.filter((r) => r.date >= range.from && r.date <= range.to);
      const metrics = computeMetrics(rows, 0);
      results.push({ label: range.label, isPartial: range.isPartial, metrics });
    } catch {
      results.push({ label: range.label, isPartial: range.isPartial, metrics: zeroMetrics() });
    }
  }
  return results;
}
```

- [ ] **Step 4: Verify**

```bash
npx vitest run
```

Expected: PASS — all tests including new fetchTrends ones.

- [ ] **Step 5: Commit**

```bash
git add lib/trends.ts lib/__tests__/trends.test.ts
git commit -m "feat(trends): add fetchTrends unified fetcher with granularity dispatch"
```

---

## Phase C — Route Layer

### Task C1: `resolveTrendParams` helper + route wiring

**Files:**
- Modify: `app/[clientId]/trends/page.tsx`

- [ ] **Step 1: Read the file to check current shape**

```bash
cat app/\[clientId\]/trends/page.tsx
```

Confirm it matches the version in the spec Section 3 Context.

- [ ] **Step 2: Replace `app/[clientId]/trends/page.tsx` contents**

```tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchTrends } from "@/lib/trends";
import { detectBrandsOrdered } from "@/lib/sheets";
import {
  parseDateParam,
  snapToGranularity,
  getDefaultRange,
  type Granularity,
  type DateRangeObj,
} from "@/lib/dates";
import { notFound } from "next/navigation";
import { TrendsClient } from "./trends-client";

function resolveTrendParams(sp: { [k: string]: string | string[] | undefined }): {
  granularity: Granularity;
  range: DateRangeObj;
  brand: string | null;
} {
  const gRaw = Array.isArray(sp.granularity) ? sp.granularity[0] : sp.granularity;
  const granularity: Granularity = gRaw === "monthly" ? "monthly" : "weekly";

  const parsedFrom = parseDateParam(Array.isArray(sp.from) ? sp.from[0] : sp.from);
  const parsedTo = parseDateParam(Array.isArray(sp.to) ? sp.to[0] : sp.to);
  const validCustom = parsedFrom && parsedTo && parsedFrom.getTime() <= parsedTo.getTime();

  const range = validCustom
    ? snapToGranularity({ from: parsedFrom!, to: parsedTo! }, granularity)
    : getDefaultRange(granularity);

  const brandRaw = Array.isArray(sp.brand) ? sp.brand[0] : sp.brand;
  const brand = brandRaw && brandRaw !== "Overall" ? brandRaw : null;

  return { granularity, range, brand };
}

export default async function TrendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) notFound();

  const brands = await detectBrandsOrdered(client.sheet_id);
  const { granularity, range, brand } = resolveTrendParams(sp);

  const trendData = await fetchTrends({
    sheetId: client.sheet_id,
    granularity,
    from: range.from,
    to: range.to,
    brandName: brand,
  });

  return (
    <TrendsClient
      data={trendData}
      brands={brands}
      selectedBrand={brand}
      clientId={clientId}
      granularity={granularity}
      range={range}
    />
  );
}
```

- [ ] **Step 3: TypeScript build check**

```bash
npx tsc --noEmit
```

Expected: errors in `trends-client.tsx` (it doesn't yet accept `granularity` / `range` props — Task D4 fixes this). OK for now.

- [ ] **Step 4: Commit**

```bash
git add app/\[clientId\]/trends/page.tsx
git commit -m "feat(trends-route): add resolveTrendParams and switch to fetchTrends"
```

(Commit accepts that `trends-client.tsx` is temporarily broken; we'll fix in Task D4.)

---

## Phase D — UI Components

### Task D1: `GranularityToggle` component

**Files:**
- Create: `components/trends/granularity-toggle.tsx`

- [ ] **Step 1: Check existing pill/segmented style**

```bash
grep -rn "pill\|segmented" app/globals.css components/ 2>&1 | head -20
```

Find the class pattern. Use `.pill` / `.pill-active` if found; otherwise match the existing DASHBOARD/TRENDS nav buttons in `app/[clientId]/layout.tsx`.

- [ ] **Step 2: Read the layout nav pattern**

```bash
cat app/\[clientId\]/layout.tsx | head -60
```

Identify exact Tailwind classes used for the DASHBOARD/TRENDS pills.

- [ ] **Step 3: Create `components/trends/granularity-toggle.tsx`**

```tsx
"use client";

import type { Granularity } from "@/lib/dates";

interface Props {
  value: Granularity;
  onChange: (next: Granularity) => void;
  pending?: boolean;
}

export function GranularityToggle({ value, onChange, pending = false }: Props) {
  const options: { key: Granularity; label: string }[] = [
    { key: "monthly", label: "Monthly" },
    { key: "weekly", label: "Weekly" },
  ];

  return (
    <div
      className={`inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg2)] p-[3px] ${
        pending ? "opacity-60" : ""
      }`}
      role="group"
      aria-label="Granularity"
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => !active && onChange(opt.key)}
            className={`px-4 py-1.5 text-[12px] font-medium rounded-full transition-colors ${
              active
                ? "bg-[var(--bg)] text-[var(--t1)] shadow-sm"
                : "text-[var(--t3)] hover:text-[var(--t1)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: still same errors from Task C1 (unused component doesn't fix them yet); no new errors from this file.

- [ ] **Step 5: Commit**

```bash
git add components/trends/granularity-toggle.tsx
git commit -m "feat(trends-ui): add GranularityToggle segmented pill"
```

---

### Task D2: `DateRangePicker` parameterization

**Files:**
- Modify: `components/dashboard/date-range-picker.tsx`

Add optional props `basePath`, `presets`, `maxRange`. Default behavior preserves current Dashboard calls.

- [ ] **Step 1: Extend `Props` interface**

Locate lines 20-22 of `components/dashboard/date-range-picker.tsx` and replace with:

```ts
import type { DatePreset } from "@/lib/dates";

interface Props {
  clientId: string;
  basePath?: string;           // default `/${clientId}`; Trends passes `/${clientId}/trends`
  presets?: readonly DatePreset[];  // default DATE_PRESETS (Dashboard presets)
  maxRange?: { weeks?: number; months?: number };
  extraParams?: Record<string, string>;  // extra URL params to preserve (e.g., granularity for Trends)
}
```

And export the `DatePreset` type from `lib/dates.ts`:

Add at the bottom of `lib/dates.ts`:

```ts
export type DatePreset = { label: string; value: string };
```

Also update `DATE_PRESETS`, `MONTHLY_PRESETS`, `WEEKLY_PRESETS` in `lib/dates.ts` to be typed as `readonly DatePreset[]`:

```ts
export const DATE_PRESETS: readonly DatePreset[] = [
  { label: "This Week", value: "this-week" },
  // ... existing items
];
export const MONTHLY_PRESETS: readonly DatePreset[] = [...];
export const WEEKLY_PRESETS: readonly DatePreset[] = [...];
```

- [ ] **Step 2: Update the component function signature**

Change the function opener (around line 24):

```tsx
export function DateRangePicker({
  clientId,
  basePath,
  presets,
  maxRange,
  extraParams,
}: Props) {
  const effectiveBasePath = basePath ?? `/${clientId}`;
  const effectivePresets = presets ?? DATE_PRESETS;
  // ... rest of function
```

- [ ] **Step 3: Update `navigate` to use `basePath` + `extraParams`**

Replace the `navigate` function body (lines 56-68) with:

```tsx
function navigate(from: Date, to: Date, prevFrom?: Date, prevTo?: Date) {
  const params = new URLSearchParams();
  params.set("from", formatDateParam(from));
  params.set("to", formatDateParam(to));
  if (prevFrom && prevTo) {
    params.set("prevFrom", formatDateParam(prevFrom));
    params.set("prevTo", formatDateParam(prevTo));
  }
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) params.set(k, v);
    }
  }
  startTransition(() => {
    router.replace(`${effectiveBasePath}?${params.toString()}`);
  });
  setOpen(false);
}
```

- [ ] **Step 4: Use `effectivePresets` in JSX**

Replace `DATE_PRESETS.map(...)` at line 143 with `effectivePresets.map(...)`.

- [ ] **Step 5: Add `maxRange` check**

Inside `handleApply` (line 91), before `navigate(...)`:

```tsx
function handleApply() {
  if (!calRange?.from || !calRange?.to) return;
  
  if (maxRange?.weeks) {
    const weeks = Math.ceil((calRange.to.getTime() - calRange.from.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weeks > maxRange.weeks) return; // Button should already be disabled; guard defense
  }
  if (maxRange?.months) {
    const months = (calRange.to.getFullYear() - calRange.from.getFullYear()) * 12
      + (calRange.to.getMonth() - calRange.from.getMonth()) + 1;
    if (months > maxRange.months) return;
  }
  
  navigate(calRange.from, calRange.to, compareRange?.from, compareRange?.to);
}
```

And in the Apply button at line 194–201, compute `disabled` with range check and show warning:

```tsx
const overLimit = (() => {
  if (!calRange?.from || !calRange?.to) return false;
  if (maxRange?.weeks) {
    const weeks = Math.ceil((calRange.to.getTime() - calRange.from.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weeks > maxRange.weeks) return true;
  }
  if (maxRange?.months) {
    const months = (calRange.to.getFullYear() - calRange.from.getFullYear()) * 12
      + (calRange.to.getMonth() - calRange.from.getMonth()) + 1;
    if (months > maxRange.months) return true;
  }
  return false;
})();

// ... in JSX:
{overLimit && (
  <div className="px-3 py-2 text-[11px] text-red-600 border-t border-[var(--border)]">
    Select a range ≤ {maxRange?.weeks ?? maxRange?.months} {maxRange?.weeks ? "weeks" : "months"} for performance reasons.
  </div>
)}
<Button
  size="sm"
  onClick={handleApply}
  disabled={!calRange?.from || !calRange?.to || overLimit}
  className="text-xs h-7 bg-[var(--blue)] hover:bg-[#153D7A] text-white"
>
  Apply
</Button>
```

- [ ] **Step 6: Build check**

```bash
npx tsc --noEmit
```

Expected: only the `trends-client.tsx` errors from Task C1 remain.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/date-range-picker.tsx lib/dates.ts
git commit -m "feat(date-picker): parameterize basePath/presets/maxRange for Trends reuse"
```

---

### Task D3: `TrendChart` isPartial-aware custom dots + label rename

**Files:**
- Modify: `components/trends/trend-chart.tsx`

- [ ] **Step 1: Rewrite `components/trends/trend-chart.tsx`**

Replace the entire file:

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
import { METRIC_OPTIONS } from "./metric-selector";
import type { TrendPoint } from "@/lib/trends";

interface TrendChartProps {
  data: TrendPoint[];
  selectedMetrics: string[];
}

const CURRENCY_METRICS = new Set(["ad_spend", "sales", "orders", "cpl", "aov"]);
const PERCENT_METRICS = new Set(["respond_rate", "appt_rate", "showup_rate", "conv_rate", "cpa_pct"]);

function formatValue(value: number, key: string): string {
  if (CURRENCY_METRICS.has(key)) {
    if (value >= 1000) return `RM ${(value / 1000).toFixed(1)}K`;
    return `RM ${value.toFixed(0)}`;
  }
  if (PERCENT_METRICS.has(key)) {
    return `${value.toFixed(1)}%`;
  }
  return String(Math.round(value));
}

function formatYAxis(value: number, isPercent: boolean): string {
  if (isPercent) return `${value}%`;
  if (value >= 1000) return `RM ${(value / 1000).toFixed(0)}K`;
  return `RM ${value}`;
}

function renderDot(color: string) {
  return (props: { cx?: number; cy?: number; payload?: { isPartial?: boolean } }) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined) return <g />;
    if (payload?.isPartial) {
      return (
        <circle cx={cx} cy={cy} r={4} fill="var(--bg)" stroke={color} strokeWidth={2} />
      );
    }
    return <circle cx={cx} cy={cy} r={4} fill={color} />;
  };
}

export function TrendChart({ data, selectedMetrics }: TrendChartProps) {
  if (selectedMetrics.length === 0) {
    return (
      <div className="card-base">
        <div className="flex items-center justify-center h-[340px] text-[var(--t4)] text-[13px]">
          Select at least one metric to display the chart.
        </div>
      </div>
    );
  }

  const chartData = data.map((point) => {
    const row: Record<string, string | number | boolean> = {
      label: point.label,
      isPartial: point.isPartial,
    };
    for (const key of selectedMetrics) {
      row[key] = (point.metrics as unknown as Record<string, number>)[key] ?? 0;
    }
    return row;
  });

  const hasLeft = selectedMetrics.some((k) => !PERCENT_METRICS.has(k));
  const hasRight = selectedMetrics.some((k) => PERCENT_METRICS.has(k));
  const isEmptyRange = data.every((p) =>
    Object.values(p.metrics).every((v) => v === 0)
  );

  return (
    <div className="card-base">
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 8, right: hasRight ? 16 : 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--t3)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          {hasLeft && (
            <YAxis
              yAxisId="left"
              orientation="left"
              tickFormatter={(v) => formatYAxis(v as number, false)}
              tick={{ fontSize: 11, fill: "var(--t3)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
          )}
          {hasRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => formatYAxis(v as number, true)}
              tick={{ fontSize: 11, fill: "var(--t3)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(label, payload) => {
              const isPartial = payload?.[0]?.payload?.isPartial;
              return isPartial ? `(incomplete) ${label}` : String(label);
            }}
            formatter={(value, name) => [formatValue(Number(value), String(name ?? "")), String(name ?? "")]}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {selectedMetrics.map((key) => {
            const opt = METRIC_OPTIONS.find((m) => m.key === key);
            if (!opt) return null;
            const yAxisId = PERCENT_METRICS.has(key) ? "right" : "left";
            return (
              <Line
                key={key}
                yAxisId={yAxisId}
                type="monotone"
                dataKey={key}
                name={opt.label}
                stroke={opt.color}
                strokeWidth={2}
                dot={renderDot(opt.color)}
                activeDot={{ r: 6, fill: opt.color, strokeWidth: 0 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
      {isEmptyRange && (
        <div className="text-[11px] text-[var(--t3)] mt-2 text-center">
          No data in selected range. Check the sheet or pick a different period.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit
```

Expected: only the `trends-client.tsx` mismatch remains (Task D4 next).

- [ ] **Step 3: Commit**

```bash
git add components/trends/trend-chart.tsx
git commit -m "feat(trend-chart): isPartial-aware hollow-ring dots + incomplete label"
```

---

### Task D4: `TrendsClient` integration

**Files:**
- Modify: `app/[clientId]/trends/trends-client.tsx`

- [ ] **Step 1: Replace file contents**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MetricSelector } from "@/components/trends/metric-selector";
import { TrendChart } from "@/components/trends/trend-chart";
import { GranularityToggle } from "@/components/trends/granularity-toggle";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import {
  formatRangeLabel,
  formatDateParam,
  getDefaultRange,
  MONTHLY_PRESETS,
  WEEKLY_PRESETS,
  type Granularity,
  type DateRangeObj,
} from "@/lib/dates";
import type { TrendPoint } from "@/lib/trends";

interface TrendsClientProps {
  data: TrendPoint[];
  brands: string[];
  selectedBrand: string | null;
  clientId: string;
  granularity: Granularity;
  range: DateRangeObj;
}

export function TrendsClient({
  data,
  brands,
  selectedBrand,
  clientId,
  granularity,
  range,
}: TrendsClientProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["sales", "cpl", "conv_rate"]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const hasMultiBrand = brands.length > 1;

  function handleBrandChange(brand: string) {
    const params = new URLSearchParams();
    params.set("granularity", granularity);
    params.set("from", formatDateParam(range.from));
    params.set("to", formatDateParam(range.to));
    if (brand !== "Overall") params.set("brand", brand);
    startTransition(() => {
      router.push(`/${clientId}/trends?${params.toString()}`);
    });
  }

  function handleGranularityChange(next: Granularity) {
    const defaultRange = getDefaultRange(next);
    const params = new URLSearchParams();
    params.set("granularity", next);
    params.set("from", formatDateParam(defaultRange.from));
    params.set("to", formatDateParam(defaultRange.to));
    if (selectedBrand) params.set("brand", selectedBrand);
    startTransition(() => {
      router.push(`/${clientId}/trends?${params.toString()}`);
    });
  }

  const subtitleCount = granularity === "weekly"
    ? Math.round((range.to.getTime() - range.from.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    : (range.to.getFullYear() - range.from.getFullYear()) * 12
      + (range.to.getMonth() - range.from.getMonth()) + 1;
  const unit = granularity === "weekly" ? "weeks" : "months";

  return (
    <div>
      <div className="flex justify-between items-start mb-7">
        <div>
          <h1 className="font-heading text-[22px] font-semibold text-[var(--t1)]">Historical Trends</h1>
          <p className="text-[14px] text-[var(--t3)] font-light mt-[3px]">
            {granularity === "weekly" ? "Weekly" : "Monthly"} performance · {formatRangeLabel(range.from, range.to)} ({subtitleCount} {unit})
            {selectedBrand && <span className="ml-1">— {selectedBrand}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GranularityToggle
            value={granularity}
            onChange={handleGranularityChange}
            pending={isPending}
          />
          <DateRangePicker
            clientId={clientId}
            basePath={`/${clientId}/trends`}
            presets={granularity === "weekly" ? WEEKLY_PRESETS : MONTHLY_PRESETS}
            maxRange={granularity === "weekly" ? { weeks: 104 } : { months: 24 }}
            extraParams={{
              granularity,
              ...(selectedBrand ? { brand: selectedBrand } : {}),
            }}
          />
          {hasMultiBrand && (
            <select
              value={selectedBrand || "Overall"}
              onChange={(e) => handleBrandChange(e.target.value)}
              className="px-3 py-2 border border-[var(--border)] rounded-lg text-[12px] bg-[var(--bg)] text-[var(--t2)]"
            >
              <option value="Overall">All Brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="card-base mb-4 p-4">
        <div className="font-label text-[11px] uppercase text-[var(--t3)] mb-3" style={{ letterSpacing: "0.2em" }}>
          Metrics
        </div>
        <MetricSelector
          selected={selectedMetrics}
          onChange={setSelectedMetrics}
          maxSelect={5}
        />
      </div>

      <TrendChart data={data} selectedMetrics={selectedMetrics} />
    </div>
  );
}
```

- [ ] **Step 2: Full TypeScript build check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Full test run**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/\[clientId\]/trends/trends-client.tsx
git commit -m "feat(trends-client): integrate granularity toggle + date picker + dynamic subtitle"
```

---

## Phase E — Verify & Ship

### Task E1: Grep and clean up `fetchMonthlyTrends`

**Files:**
- Potentially modify: `lib/trends.ts` (deletion)

- [ ] **Step 1: Grep consumers**

```bash
cd ~/Claude/Project/funnel-dashboard && grep -rn "fetchMonthlyTrends\|MonthlyTrendPoint" --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Decide**

If the ONLY references are in `lib/trends.ts` itself (the declaration and the alias), delete both:
- Remove the `fetchMonthlyTrends` function
- Remove the `export type MonthlyTrendPoint = TrendPoint;` alias

If there are other consumers, leave them and add a TODO note pointing to this plan's follow-ups section. Do not migrate them in this PR — out of scope.

- [ ] **Step 3: If deleted, verify build + tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 errors, all tests pass.

- [ ] **Step 4: Commit (if any deletion)**

```bash
git add lib/trends.ts
git commit -m "chore(trends): remove unused fetchMonthlyTrends + MonthlyTrendPoint alias"
```

---

### Task E2: Full build + test

- [ ] **Step 1: Full Next.js build**

```bash
cd ~/Claude/Project/funnel-dashboard && npm run build
```

Expected: "Compiled successfully" + all pages generated. If build fails due to missing env vars (`.env.local`), confirm with user — some builds need the Supabase/Google keys.

- [ ] **Step 2: Full test suite**

```bash
npx vitest run
```

Expected: all tests pass (17 original + ~30 new = ~47 tests).

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings in changed files.

- [ ] **Step 4: If any issues, fix and re-run; only commit fixes if required**

No commit needed unless fixes were made.

---

### Task E3: Dev server manual smoke tests

- [ ] **Step 1: Start dev server**

```bash
cd ~/Claude/Project/funnel-dashboard && npm run dev
```

Wait for "Ready in X ms".

- [ ] **Step 2: Open browser**

Navigate to `http://localhost:3000/<clientId>/trends` (replace `<clientId>` with a real client ID from the DB — check `/projects` page for the list).

- [ ] **Step 3: Execute the 10-item checklist**

1. [ ] Default view loads as Weekly × last 4 weeks; last week has a hollow ring dot
2. [ ] Clicking `[Monthly]` resets range to last 6 months; URL updates to `?granularity=monthly&from=...&to=...`
3. [ ] Click date-picker → Custom → pick Jan 1 2025 – Apr 30 2025 in Monthly view → 4 solid-dot monthly points load
4. [ ] Toggle back to Weekly → range resets to last 4 weeks (the 2025 range is NOT preserved)
5. [ ] Hard refresh (Cmd+Shift+R) → URL-derived state restores exactly
6. [ ] Manually edit URL to `?granularity=weekly&from=2025-07-07&to=2025-08-03` → loads 4 weekly points all solid (historical)
7. [ ] Set `from=bad-date` in URL → silently falls back to default (no 500/blank page)
8. [ ] Change Brand dropdown → trend re-filters; granularity + range preserved in URL
9. [ ] Hover a partial dot → tooltip shows `(incomplete)` prefix
10. [ ] Browser DevTools Console → no errors or warnings

- [ ] **Step 4: Stop dev server (Ctrl+C)**

No commit — this is manual validation only.

---

### Task E4: Push to remote + Vercel preview

- [ ] **Step 1: Confirm branch state is clean**

```bash
git status -sb
```

Expected: clean working tree; branch `feat/trends-weekly-historical` ahead of `origin` by N commits.

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/trends-weekly-historical
```

- [ ] **Step 3: Wait for Vercel preview**

Vercel will auto-detect the push and start a preview build. Watch for the bot comment on the branch via:

```bash
gh pr view --web 2>/dev/null || echo "No PR yet — checking Vercel via API"
# Or check https://vercel.com/dashboard for the preview URL
```

- [ ] **Step 4: Open preview URL in browser**

Re-run the 10-item smoke checklist from Task E3 on the preview deployment (production-like env vars).

- [ ] **Step 5: If preview passes, proceed to E5; if not, investigate, fix, commit, push again**

---

### Task E5: Open PR

- [ ] **Step 1: Create PR**

```bash
cd ~/Claude/Project/funnel-dashboard && gh pr create --title "feat(trends): weekly granularity + historical range picker" --body "$(cat <<'EOF'
## Summary
- Adds segmented Monthly/Weekly toggle on `/[clientId]/trends` (defaults to Weekly)
- Replaces fixed "last 6 months" with arbitrary historical date range picker; supports preset chips per granularity + custom calendar range
- Partial in-progress periods (current week/month) render as hollow-ring dots with `(incomplete)` tooltip suffix to prevent misreading mid-period data as a decline

## Spec & Plan
- Design: `docs/superpowers/specs/2026-04-24-trends-weekly-historical-range-design.md`
- Plan: `docs/superpowers/plans/2026-04-24-trends-weekly-historical.md`

## Test plan
- [x] vitest suite passes (~47 tests; ~30 new)
- [x] `npm run build` succeeds
- [x] `npm run lint` clean
- [x] Manual smoke checklist run on `localhost:3000/<clientId>/trends` (10 scenarios)
- [ ] Re-run smoke checklist on Vercel preview URL
- [ ] Verify existing Dashboard page DateRangePicker still works unchanged (backward-compat check)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Return PR URL to user**

The PR URL from `gh pr create` output is the handoff point. User reviews, re-tests on preview if wanted, merges when satisfied. Merge auto-deploys to production.

---

## Follow-ups (post-merge, out of scope for this PR)

- Update `CONTINUE.md` path (currently wrong `/Users/khoweijie/Documents/funnel-dashboard`; actual `/Users/khoweijie/Claude/Project/funnel-dashboard`)
- Update memory file `project_dashboard_saas.md` — 16+ days stale
- Evaluate dashed last-segment line rendering if Recharts adds per-segment stroke support
- If `fetchMonthlyTrends` or `MonthlyTrendPoint` had non-page.tsx consumers retained in E1, migrate them and delete the aliases

---

## Self-Review Checklist

- [x] **Spec coverage:** All 8 design decisions from the spec's Decision Summary are implemented in specific tasks (toggle in D1, reset-on-switch in D4, hollow dot in D3, `Apr 14 – 20` label in A4, Weekly default in C1, MONTHLY/WEEKLY_PRESETS in A6/D2, maxRange cap in D2)
- [x] **Placeholder scan:** No TBD/TODO/placeholders in implementation steps; every code step shows the actual code
- [x] **Type consistency:** `TrendPoint` / `TrendRange` / `Granularity` names consistent across all tasks; `fetchTrends` signature same in B4 + C1; `label` prop same in B1/B2/B3/D3
- [x] **Commit granularity:** 14–15 small commits, each shipping a testable unit
