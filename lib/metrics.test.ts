import { describe, it, expect } from "vitest";
import { computeMetrics, computeMoM, computeAchievement, budgetScenario } from "./metrics";
import type { DailyMetric, KPIConfig } from "./types";

const sampleRows: DailyMetric[] = [
  { date: new Date("2026-03-01"), ad_spend: 250, inquiry: 10, contact: 5, appointment: 1, showup: 0, orders: 0, sales: 0 },
  { date: new Date("2026-03-02"), ad_spend: 260, inquiry: 12, contact: 4, appointment: 2, showup: 1, orders: 1, sales: 40000 },
];

describe("computeMetrics", () => {
  it("aggregates daily rows into funnel metrics", () => {
    const m = computeMetrics(sampleRows, 3);
    expect(m.ad_spend).toBe(510);
    expect(m.inquiry).toBe(22);
    expect(m.contact).toBe(9);
    expect(m.orders).toBe(1);
    expect(m.sales).toBe(40000);
    expect(m.cpl).toBeCloseTo(510 / 22, 2);
    expect(m.respond_rate).toBeCloseTo(9 / 22 * 100, 1);
    expect(m.showup_rate).toBeCloseTo(1 / 3 * 100, 1);
    expect(m.roas).toBeCloseTo(40000 / 510, 1);
  });

  it("handles zero denominators", () => {
    const m = computeMetrics([], 0);
    expect(m.cpl).toBe(0);
    expect(m.roas).toBe(0);
    expect(m.aov).toBe(0);
  });
});

describe("computeMoM", () => {
  it("computes percentage changes", () => {
    const current = computeMetrics(sampleRows, 3);
    const previous = computeMetrics([sampleRows[0]], 1);
    const mom = computeMoM(current, previous);
    expect(mom.ad_spend).toBeCloseTo((510 - 250) / 250 * 100, 1);
    expect(mom.inquiry).toBeCloseTo((22 - 10) / 10 * 100, 1);
  });
});

const testKPI: KPIConfig = {
  sales: 300000, orders: 6, aov: 50000, cpl: 26, respond_rate: 30,
  appt_rate: 33, showup_rate: 90, conv_rate: 25, ad_spend: 7500,
  daily_ad: 250, roas: 40, cpa_pct: 2.5, target_contact: 80,
  target_appt: 27, target_showup: 24,
};

describe("computeAchievement", () => {
  it("returns percentage of KPI achieved", () => {
    const m = computeMetrics(sampleRows, 3);
    const ach = computeAchievement(m, testKPI);
    expect(ach.sales).toBeCloseTo(40000 / 300000 * 100, 1);
    expect(ach.orders).toBeCloseTo(1 / 6 * 100, 1);
  });
});

describe("budgetScenario", () => {
  it("projects next month sales from pipeline", () => {
    const m = computeMetrics(sampleRows, 3);
    const sc = budgetScenario(510, m, testKPI, 5);
    expect(sc.spend).toBe(510);
    expect(sc.inquiry).toBeCloseTo(510 / m.cpl, 0);
    expect(sc.pipeline).toBeGreaterThan(5);
    expect(sc.sales).toBeGreaterThan(0);
  });
});
