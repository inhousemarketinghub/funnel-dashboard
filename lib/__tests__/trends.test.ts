import { describe, it, expect } from "vitest";
import { getMonthRanges, getWeekRanges } from "../trends";

describe("getMonthRanges", () => {
  it("returns correct ranges for 3 months back from April 2026", () => {
    const ranges = getMonthRanges(3, new Date(2026, 3, 8));
    expect(ranges).toHaveLength(3);
    expect(ranges[0].label).toBe("Feb 2026");
    expect(ranges[0].from.getMonth()).toBe(1);
    expect(ranges[1].label).toBe("Mar 2026");
    expect(ranges[2].label).toBe("Apr 2026");
    expect(ranges[2].to.getDate()).toBe(8);
  });

  it("returns 6 ranges for 6 months", () => {
    const ranges = getMonthRanges(6, new Date(2026, 3, 15));
    expect(ranges).toHaveLength(6);
    expect(ranges[0].label).toBe("Nov 2025");
    expect(ranges[5].label).toBe("Apr 2026");
  });
});

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
    expect(ranges[3].isPartial).toBe(true);
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
