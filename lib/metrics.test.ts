import { describe, it, expect } from "vitest";
import { computeMetrics, computeMoM, computeAchievement, budgetScenario } from "./metrics";
import type { DailyMetric, KPIConfig } from "./types";

const sampleRows: DailyMetric[] = [
  { date: new Date("2026-03-01"), ad_spend: 250, lead_funnel_spend: 100, branding_spend: 50, inquiry: 10, contact: 5, appointment: 1, showup: 0, orders: 0, sales: 0 },
  { date: new Date("2026-03-02"), ad_spend: 260, lead_funnel_spend: 110, branding_spend: 50, inquiry: 12, contact: 4, appointment: 2, showup: 1, orders: 1, sales: 40000 },
];

describe("computeMetrics", () => {
  it("aggregates daily rows into funnel metrics", () => {
    const m = computeMetrics(sampleRows, 3);
    // Total is derived from the split: (Lead Funnel + Branding) × 1.08
    expect(m.ad_spend).toBeCloseTo((210 + 100) * 1.08, 2);
    expect(m.inquiry).toBe(22);
    expect(m.contact).toBe(9);
    expect(m.orders).toBe(1);
    expect(m.sales).toBe(40000);
    expect(m.lead_funnel_spend).toBe(210);
    expect(m.branding_spend).toBe(100);
    // CPL = (Lead Funnel × 1.08) / leads, not taxed total / leads
    expect(m.cpl).toBeCloseTo((210 * 1.08) / 22, 2);
    expect(m.respond_rate).toBeCloseTo(9 / 22 * 100, 1);
    expect(m.showup_rate).toBeCloseTo(1 / 3 * 100, 1);
    expect(m.roas).toBeCloseTo(40000 / ((210 + 100) * 1.08), 1);
  });

  it("derived total reconciles exactly with the taxed breakdown lines", () => {
    const m = computeMetrics(sampleRows, 3);
    expect(m.ad_spend).toBeCloseTo(m.lead_funnel_spend * 1.08 + m.branding_spend * 1.08, 6);
  });

  it("handles zero denominators", () => {
    const m = computeMetrics([], 0);
    expect(m.cpl).toBe(0);
    expect(m.roas).toBe(0);
    expect(m.aov).toBe(0);
  });

  it("CPL = 0 when Lead Funnel is 0 but Branding has spend (split exists)", () => {
    const rows: DailyMetric[] = [
      { date: new Date("2026-03-01"), ad_spend: 270, lead_funnel_spend: 0, branding_spend: 250, inquiry: 10, contact: 0, appointment: 0, showup: 0, orders: 0, sales: 0 },
    ];
    const m = computeMetrics(rows, 0);
    expect(m.cpl).toBe(0);
  });

  it("falls back to taxed total / leads when no split columns present", () => {
    const rows: DailyMetric[] = [
      { date: new Date("2026-03-01"), ad_spend: 250, lead_funnel_spend: 0, branding_spend: 0, inquiry: 10, contact: 0, appointment: 0, showup: 0, orders: 0, sales: 0 },
    ];
    const m = computeMetrics(rows, 0);
    expect(m.cpl).toBeCloseTo(250 / 10, 2);
  });
});

describe("computeMoM", () => {
  it("computes percentage changes", () => {
    const current = computeMetrics(sampleRows, 3);
    const previous = computeMetrics([sampleRows[0]], 1);
    const mom = computeMoM(current, previous);
    // Totals are derived: current (210+100)×1.08, previous (100+50)×1.08
    expect(mom.ad_spend).toBeCloseTo((310 * 1.08 - 150 * 1.08) / (150 * 1.08) * 100, 1);
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
