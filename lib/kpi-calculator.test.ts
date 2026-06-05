import { describe, it, expect } from "vitest";
import { computeSettingsDerived } from "./kpi-calculator";

// These expectations are anchored to the REAL Google Sheet "KPI Indicator" tab.
// The sheet chains every formula at full precision and only rounds for DISPLAY,
// so the app must do the same (no Math.round on intermediate steps).

describe("computeSettingsDerived — walk-in, matches the sheet (no intermediate rounding)", () => {
  // The Couch Factory column in the sheet: Sales 200000 → FB Leads displays 635, CPL 14.58
  const form = { sales: 200000, aov: 3500, cpa_pct: 5, conv_rate: 60, respond_rate: 15 };
  const d = computeSettingsDerived(form, "walkin", 30);

  it("keeps Order at full precision (not rounded to 57)", () => {
    expect(d.orders).toBeCloseTo(57.142857, 4);
    expect(Number.isInteger(d.orders)).toBe(false);
  });

  it("keeps Visit at full precision (not rounded to 95)", () => {
    expect(d.target_visit).toBeCloseTo(95.238095, 4);
    expect(Number.isInteger(d.target_visit)).toBe(false);
  });

  it("computes FB Leads as 634.92 → displays 635 (the bug was 633)", () => {
    expect(d.fb_leads).toBeCloseTo(634.920634, 3);
    expect(Math.round(d.fb_leads)).toBe(635);
  });

  it("computes CPL as RM14.58 (matches sheet cell E8/L8/S8 = 14.58)", () => {
    expect(d.cpl).toBeCloseTo(14.5833, 3);
  });

  it("computes CP.Acquisition 162.04 and CP.Visit 97.22 (matches sheet)", () => {
    expect(d.cp_acquisition).toBeCloseTo(162.037, 2);
    expect(d.cp_visit).toBeCloseTo(97.222, 2);
  });
});

describe("computeSettingsDerived — walk-in, Carress column (Sales 50000)", () => {
  const form = { sales: 50000, aov: 3500, cpa_pct: 5, conv_rate: 60, respond_rate: 15 };
  const d = computeSettingsDerived(form, "walkin", 30);

  it("FB Leads 158.73 → displays 159 (matches sheet cell G8 = 159)", () => {
    expect(d.fb_leads).toBeCloseTo(158.730, 2);
    expect(Math.round(d.fb_leads)).toBe(159);
  });

  it("CPL stays RM14.58 regardless of sales scale", () => {
    expect(d.cpl).toBeCloseTo(14.5833, 3);
  });
});

describe("computeSettingsDerived — appointment funnel, no intermediate rounding", () => {
  const form = {
    sales: 200000, aov: 3500, cpa_pct: 5, conv_rate: 60,
    showup_rate: 50, appt_rate: 80, respond_rate: 70,
  };
  const d = computeSettingsDerived(form, "appointment", 30);

  it("chains Show Up → Appointment → Contact at full precision", () => {
    expect(d.target_showup).toBeCloseTo(95.238, 2);
    expect(d.target_appt).toBeCloseTo(190.476, 2);
    expect(d.target_contact).toBeCloseTo(238.095, 2);
    expect(Number.isInteger(d.target_appt)).toBe(false);
  });

  it("computes FB Leads 340.14 → displays 340", () => {
    expect(d.fb_leads).toBeCloseTo(340.136, 2);
    expect(Math.round(d.fb_leads)).toBe(340);
  });
});

describe("computeSettingsDerived — Daily Ad Spend uses the days-in-month passed in (choice B)", () => {
  const form = { sales: 200000, aov: 3500, cpa_pct: 5, conv_rate: 60, respond_rate: 15 };

  it("divides monthly by the real day count, not a fixed 30", () => {
    const feb = computeSettingsDerived(form, "walkin", 28);
    expect(feb.daily_ad_targeted_incl).toBeCloseTo(10000 / 28, 2);
    expect(feb.days_in_month).toBe(28);
  });
});
