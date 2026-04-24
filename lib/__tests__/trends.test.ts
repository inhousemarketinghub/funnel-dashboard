import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMonthRanges, getWeekRanges, fetchTrends } from "../trends";

vi.mock("../sheets", () => ({
  fetchPerformanceData: vi.fn(),
}));
import { fetchPerformanceData } from "../sheets";

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

describe("fetchTrends", () => {
  const now = new Date(2026, 3, 24);

  beforeEach(() => {
    vi.mocked(fetchPerformanceData).mockReset();
  });

  it("weekly: returns 4 TrendPoints with bucketed metrics", async () => {
    vi.mocked(fetchPerformanceData).mockResolvedValue({
      data: [
        { date: new Date(2026, 3, 1), ad_spend: 100, inquiry: 10, contact: 5, appointment: 3, showup: 2, orders: 1, sales: 500 },
        { date: new Date(2026, 3, 15), ad_spend: 200, inquiry: 20, contact: 10, appointment: 6, showup: 4, orders: 2, sales: 1000 },
      ],
      headers: [],
    } as unknown as Awaited<ReturnType<typeof fetchPerformanceData>>);

    const points = await fetchTrends({
      sheetId: "fake",
      granularity: "weekly",
      from: new Date(2026, 2, 30),
      to: new Date(2026, 3, 26),
      now,
    });

    expect(points).toHaveLength(4);
    // Apr 1 falls in week 0 (Mar 30 – Apr 5)
    expect(points[0].label).toBe("Mar 30 – Apr 5");
    expect(points[0].metrics.ad_spend).toBe(100);
    // Apr 15 falls in week 2 (Apr 13 – 19)
    expect(points[2].metrics.ad_spend).toBe(200);
    // Apr 20 – 26 is current week (weekEnd 26 > now 24) → partial
    expect(points[3].isPartial).toBe(true);
  });

  it("monthly: returns TrendPoints labeled by month", async () => {
    vi.mocked(fetchPerformanceData).mockResolvedValue({
      data: [],
      headers: [],
    } as unknown as Awaited<ReturnType<typeof fetchPerformanceData>>);

    const points = await fetchTrends({
      sheetId: "fake",
      granularity: "monthly",
      from: new Date(2026, 1, 1),
      to: new Date(2026, 3, 30),
      now,
    });

    expect(points).toHaveLength(3);
    expect(points.map((p) => p.label)).toEqual(["Feb 2026", "Mar 2026", "Apr 2026"]);
    expect(points.every((p) => p.metrics.ad_spend === 0)).toBe(true);
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
