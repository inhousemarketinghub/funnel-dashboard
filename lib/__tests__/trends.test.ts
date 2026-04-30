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

  it("weekly: returns bundle.current with 4 TrendPoints + bucketed metrics", async () => {
    vi.mocked(fetchPerformanceData).mockResolvedValue({
      data: [
        { date: new Date(2026, 3, 1), ad_spend: 100, inquiry: 10, contact: 5, appointment: 3, showup: 2, orders: 1, sales: 500 },
        { date: new Date(2026, 3, 15), ad_spend: 200, inquiry: 20, contact: 10, appointment: 6, showup: 4, orders: 2, sales: 1000 },
      ],
      headers: [],
    } as unknown as Awaited<ReturnType<typeof fetchPerformanceData>>);

    const bundle = await fetchTrends({
      sheetId: "fake",
      granularity: "weekly",
      from: new Date(2026, 2, 30),
      to: new Date(2026, 3, 26),
      now,
    });

    expect(bundle.current).toHaveLength(4);
    expect(bundle.current[0].label).toBe("Mar 30 – Apr 5");
    expect(bundle.current[0].metrics.ad_spend).toBe(100);
    expect(bundle.current[2].metrics.ad_spend).toBe(200);
    expect(bundle.current[3].isPartial).toBe(true);
    expect(bundle.comparison).toBeUndefined();
    expect(bundle.avgComparison).toBeUndefined();
    // Pooled avg over the entire range: total ad_spend = 300, total inquiry = 30 → CPL = 10
    expect(bundle.avgCurrent.ad_spend).toBe(300);
    expect(bundle.avgCurrent.cpl).toBeCloseTo(10, 5);
  });

  it("monthly: returns bundle with month-labeled TrendPoints", async () => {
    vi.mocked(fetchPerformanceData).mockResolvedValue({
      data: [],
      headers: [],
    } as unknown as Awaited<ReturnType<typeof fetchPerformanceData>>);

    const bundle = await fetchTrends({
      sheetId: "fake",
      granularity: "monthly",
      from: new Date(2026, 1, 1),
      to: new Date(2026, 3, 30),
      now,
    });

    expect(bundle.current).toHaveLength(3);
    expect(bundle.current.map((p) => p.label)).toEqual(["Feb 2026", "Mar 2026", "Apr 2026"]);
    expect(bundle.current.every((p) => p.metrics.ad_spend === 0)).toBe(true);
    expect(bundle.avgCurrent.ad_spend).toBe(0);
  });

  it("returns zero metrics for all ranges when fetch throws", async () => {
    vi.mocked(fetchPerformanceData).mockRejectedValue(new Error("boom"));

    const bundle = await fetchTrends({
      sheetId: "fake",
      granularity: "weekly",
      from: new Date(2026, 2, 30),
      to: new Date(2026, 3, 26),
      now,
    });

    expect(bundle.current).toHaveLength(4);
    expect(bundle.current.every((p) => p.metrics.ad_spend === 0)).toBe(true);
    expect(bundle.avgCurrent.ad_spend).toBe(0);
  });
});

describe("fetchTrends with comparison", () => {
  const now = new Date(2026, 3, 24);

  beforeEach(() => {
    vi.mocked(fetchPerformanceData).mockReset();
  });

  it("returns comparison + avgComparison when comparisonFrom/To provided", async () => {
    vi.mocked(fetchPerformanceData).mockResolvedValue({
      data: [
        // Current period: Apr 13 – Apr 26 (2 weeks)
        { date: new Date(2026, 3, 14), ad_spend: 300, inquiry: 30, contact: 15, appointment: 9, showup: 6, orders: 3, sales: 1500 },
        // Comparison period: Mar 30 – Apr 12 (2 weeks)
        { date: new Date(2026, 2, 31), ad_spend: 100, inquiry: 10, contact: 5, appointment: 3, showup: 2, orders: 1, sales: 500 },
      ],
      headers: [],
    } as unknown as Awaited<ReturnType<typeof fetchPerformanceData>>);

    const bundle = await fetchTrends({
      sheetId: "fake",
      granularity: "weekly",
      from: new Date(2026, 3, 13),
      to: new Date(2026, 3, 26),
      comparisonFrom: new Date(2026, 2, 30),
      comparisonTo: new Date(2026, 3, 12),
      now,
    });

    expect(bundle.current).toHaveLength(2);
    expect(bundle.comparison).toHaveLength(2);
    expect(bundle.comparison![0].label).toBe("Mar 30 – Apr 5");
    expect(bundle.avgCurrent.ad_spend).toBe(300);
    expect(bundle.avgComparison?.ad_spend).toBe(100);
  });

  it("avgCurrent uses POOLED averaging (not arithmetic mean of weekly ratios)", async () => {
    // Week 1: ad_spend=100, inquiry=10  → CPL=10
    // Week 2: ad_spend=900, inquiry=30  → CPL=30
    // Arithmetic mean of weekly CPLs would be 20.
    // POOLED CPL = total_ad_spend (1000) / total_inquiry (40) = 25  ← correct.
    vi.mocked(fetchPerformanceData).mockResolvedValue({
      data: [
        { date: new Date(2026, 3, 1),  ad_spend: 100, inquiry: 10, contact: 0, appointment: 0, showup: 0, orders: 0, sales: 0 },
        { date: new Date(2026, 3, 15), ad_spend: 900, inquiry: 30, contact: 0, appointment: 0, showup: 0, orders: 0, sales: 0 },
      ],
      headers: [],
    } as unknown as Awaited<ReturnType<typeof fetchPerformanceData>>);

    const bundle = await fetchTrends({
      sheetId: "fake",
      granularity: "weekly",
      from: new Date(2026, 2, 30),
      to: new Date(2026, 3, 26),
      now,
    });

    expect(bundle.avgCurrent.cpl).toBeCloseTo(25, 5);
    expect(bundle.avgCurrent.cpl).not.toBeCloseTo(20, 1); // not the arithmetic mean
  });

  it("calls fetchPerformanceData only once even with comparison range", async () => {
    vi.mocked(fetchPerformanceData).mockResolvedValue({
      data: [],
      headers: [],
    } as unknown as Awaited<ReturnType<typeof fetchPerformanceData>>);

    await fetchTrends({
      sheetId: "fake",
      granularity: "weekly",
      from: new Date(2026, 3, 13),
      to: new Date(2026, 3, 26),
      comparisonFrom: new Date(2026, 2, 30),
      comparisonTo: new Date(2026, 3, 12),
      now,
    });

    expect(vi.mocked(fetchPerformanceData).mock.calls).toHaveLength(1);
  });
});

describe("fetchTrends funnelType behaviour", () => {
  const now = new Date(2026, 3, 24);

  beforeEach(() => {
    vi.mocked(fetchPerformanceData).mockReset();
  });

  it("walkin: conv_rate uses orders/contact (not orders/showup) so it isn't always 0", async () => {
    // Walk-in funnel has no showup data. With default appointment formula (orders/showup),
    // conv_rate would be 0. With walkin (orders/contact), 4/20 = 20%.
    vi.mocked(fetchPerformanceData).mockResolvedValue({
      data: [
        { date: new Date(2026, 3, 14), ad_spend: 100, inquiry: 30, contact: 20, appointment: 0, showup: 0, orders: 4, sales: 800 },
      ],
      headers: [],
    } as unknown as Awaited<ReturnType<typeof fetchPerformanceData>>);

    const bundle = await fetchTrends({
      sheetId: "fake",
      granularity: "weekly",
      from: new Date(2026, 3, 13),
      to: new Date(2026, 3, 19),
      funnelType: "walkin",
      now,
    });

    expect(bundle.current[0].metrics.conv_rate).toBeCloseTo(20, 5);
    expect(bundle.avgCurrent.conv_rate).toBeCloseTo(20, 5);
  });

  it("appointment (default): conv_rate uses orders/showup", async () => {
    vi.mocked(fetchPerformanceData).mockResolvedValue({
      data: [
        { date: new Date(2026, 3, 14), ad_spend: 100, inquiry: 30, contact: 20, appointment: 10, showup: 8, orders: 4, sales: 800 },
      ],
      headers: [],
    } as unknown as Awaited<ReturnType<typeof fetchPerformanceData>>);

    const bundle = await fetchTrends({
      sheetId: "fake",
      granularity: "weekly",
      from: new Date(2026, 3, 13),
      to: new Date(2026, 3, 19),
      now,
    });

    // 4/8 = 50%
    expect(bundle.current[0].metrics.conv_rate).toBeCloseTo(50, 5);
  });
});
