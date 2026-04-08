import { describe, it, expect } from "vitest";
import { getMonthRanges } from "../trends";

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
