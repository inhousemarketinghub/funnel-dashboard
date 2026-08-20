import { describe, it, expect } from "vitest";
import { computeDateCoverage, runSanityChecks } from "./diagnostics";
import type { DailyMetric, FunnelMetrics } from "./types";

const day = (d: number): DailyMetric => ({
  date: new Date(2026, 7, d),
  ad_spend: 100, lead_funnel_spend: 90, branding_spend: 10,
  inquiry: 5, contact: 3, appointment: 1, est_showup: 1, showup: 1, orders: 0, sales: 0,
});

describe("computeDateCoverage", () => {
  it("lists missing days up to today for the current month", () => {
    const data = [day(1), day(2), day(4)];
    const c = computeDateCoverage(data, 2026, 7, new Date(2026, 7, 5));
    expect(c.presentDays).toEqual([1, 2, 4]);
    expect(c.missingDays).toEqual([3, 5]);
    expect(c.lastCheckedDay).toBe(5);
  });

  it("does not count future days as missing", () => {
    const c = computeDateCoverage([day(1)], 2026, 7, new Date(2026, 7, 2));
    expect(c.missingDays).toEqual([2]);
  });

  it("checks the whole month for past months", () => {
    const c = computeDateCoverage([day(1)], 2026, 7, new Date(2026, 8, 15));
    expect(c.lastCheckedDay).toBe(31);
    expect(c.missingDays).toHaveLength(30);
  });

  it("reports full coverage cleanly", () => {
    const data = [day(1), day(2), day(3)];
    const c = computeDateCoverage(data, 2026, 7, new Date(2026, 7, 3));
    expect(c.missingDays).toEqual([]);
  });

  it("ignores rows from other months", () => {
    const other: DailyMetric = { ...day(1), date: new Date(2026, 6, 1) };
    const c = computeDateCoverage([other], 2026, 7, new Date(2026, 7, 1));
    expect(c.presentDays).toEqual([]);
    expect(c.missingDays).toEqual([1]);
  });
});

const baseMetrics: FunnelMetrics = {
  ad_spend: 1000, lead_funnel_spend: 900, branding_spend: 100,
  inquiry: 50, contact: 20, appointment: 10, est_showup: 8, showup: 6, orders: 3, sales: 9000,
  cpl: 20, respond_rate: 40, appt_rate: 50, showup_rate: 75, conv_rate: 50,
  aov: 3000, roas: 9, cpa_pct: 11,
};
const allTracked = { appointment: true, est_showup: true, showup: true };

describe("runSanityChecks", () => {
  it("passes a healthy month with no issues", () => {
    expect(runSanityChecks(baseMetrics, allTracked, "appointment")).toEqual([]);
  });

  it("flags showup exceeding est_showup", () => {
    const m = { ...baseMetrics, showup: 10, est_showup: 8 };
    const issues = runSanityChecks(m, allTracked, "appointment");
    expect(issues.map((i) => i.code)).toContain("showup_exceeds_est");
  });

  it("skips showup checks when the metric is untracked (no false alarm from silent 0)", () => {
    const m = { ...baseMetrics, showup: 0, est_showup: 0, orders: 3 };
    const untracked = { appointment: true, est_showup: false, showup: false };
    // orders(3) > showup(0) would fire if we compared against the silent 0
    expect(runSanityChecks(m, untracked, "appointment")).toEqual([]);
  });

  it("flags orders exceeding showup on appointment funnels only", () => {
    const m = { ...baseMetrics, orders: 8, showup: 6 };
    expect(runSanityChecks(m, allTracked, "appointment").map((i) => i.code)).toContain("orders_exceed_showup");
    expect(runSanityChecks(m, allTracked, "walkin")).toEqual([]);
  });

  it("flags contact exceeding inquiry", () => {
    const m = { ...baseMetrics, contact: 60, inquiry: 50 };
    expect(runSanityChecks(m, allTracked, "appointment").map((i) => i.code)).toContain("contact_exceeds_inquiry");
  });

  it("flags sales recorded without any orders", () => {
    const m = { ...baseMetrics, orders: 0, sales: 5000 };
    const issues = runSanityChecks(m, allTracked, "appointment");
    expect(issues.map((i) => i.code)).toContain("sales_without_orders");
  });
});
