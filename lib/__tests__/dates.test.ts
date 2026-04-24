import { describe, it, expect } from "vitest";
import { getMondayOf, getSundayOf, snapToGranularity, isPartialRange } from "../dates";

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
