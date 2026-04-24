import { describe, it, expect } from "vitest";
import { getMondayOf, getSundayOf, snapToGranularity, isPartialRange, formatWeekLabel, getDefaultRange, getPresetRange, MONTHLY_PRESETS, WEEKLY_PRESETS } from "../dates";

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

describe("getDefaultRange(granularity)", () => {
  const now = new Date(2026, 3, 24); // Apr 24 2026, a Friday

  it("weekly: returns last 4 weeks ending this Sunday", () => {
    const result = getDefaultRange("weekly", now);
    expect(result.from).toEqual(new Date(2026, 2, 30));
    expect(result.to).toEqual(new Date(2026, 3, 26));
  });

  it("monthly: returns last 6 months ending this month's last day", () => {
    const result = getDefaultRange("monthly", now);
    expect(result.from).toEqual(new Date(2025, 10, 1));
    expect(result.to).toEqual(new Date(2026, 3, 30));
  });

  it("no-arg form preserves existing behavior (1st of current month → today)", () => {
    const result = getDefaultRange();
    expect(result.from.getDate()).toBe(1);
    expect(result.to.getTime()).toBeGreaterThanOrEqual(result.from.getTime());
  });
});

describe("Trends presets", () => {
  const now = new Date(2026, 3, 24); // Apr 24 2026 Fri

  it("MONTHLY_PRESETS exports expected values", () => {
    expect(MONTHLY_PRESETS.map((p) => p.value)).toEqual([
      "last-3m", "last-6m", "last-12m", "ytd",
    ]);
  });

  it("WEEKLY_PRESETS exports expected values", () => {
    expect(WEEKLY_PRESETS.map((p) => p.value)).toEqual([
      "last-4w", "last-8w", "last-12w", "last-26w",
    ]);
  });

  it("last-4w → Mar 30 – Apr 26 when now=Apr 24 2026", () => {
    const r = getPresetRange("last-4w", now);
    expect(r.from).toEqual(new Date(2026, 2, 30));
    expect(r.to).toEqual(new Date(2026, 3, 26));
  });

  it("last-12w → 12 Mon-Sun weeks ending this Sunday", () => {
    const r = getPresetRange("last-12w", now);
    expect(r.to).toEqual(new Date(2026, 3, 26));
    // 12 weeks = Sun - (12*7 - 1) days = Sun - 83 days = Feb 2 2026 (Monday)
    expect(r.from).toEqual(new Date(2026, 1, 2));
  });

  it("last-6m → Nov 1 2025 – Apr 30 2026 when now=Apr 24 2026", () => {
    const r = getPresetRange("last-6m", now);
    expect(r.from).toEqual(new Date(2025, 10, 1));
    expect(r.to).toEqual(new Date(2026, 3, 30));
  });

  it("ytd → Jan 1 – Apr 30 2026 when now=Apr 24 2026", () => {
    const r = getPresetRange("ytd", now);
    expect(r.from).toEqual(new Date(2026, 0, 1));
    expect(r.to).toEqual(new Date(2026, 3, 30));
  });
});
