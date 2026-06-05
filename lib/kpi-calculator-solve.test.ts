import { describe, it, expect } from "vitest";
import { completeInputs, computeSettingsDerived } from "./kpi-calculator";

// Each calculator solves the same funnel equation for a different unknown.
// Correctness is proven by ROUND-TRIP: forward-compute CPL from a known base
// input, then feed that CPL into the inverse calculator and recover the input.
// (The sheet's hand-entered brand columns aren't internally consistent, so they
// can't be the oracle — the math is.)

describe("completeInputs — walk-in inverse calculators", () => {
  const base = { sales: 200000, aov: 3500, cpa_pct: 5, conv_rate: 60, respond_rate: 15 };
  const fwd = computeSettingsDerived(base, "walkin", 30); // full-precision CPL

  it("cpl mode returns the base inputs unchanged", () => {
    expect(completeInputs("cpl", "walkin", base)).toEqual(base);
  });

  it("visit_rate mode recovers Visit Rate 15 from the computed CPL", () => {
    const out = completeInputs("visit_rate", "walkin", {
      sales: 200000, aov: 3500, cpa_pct: 5, conv_rate: 60, cpl: fwd.cpl,
    });
    expect(out.respond_rate).toBeCloseTo(15, 4);
    // forward-computing from the completed set reproduces the same CPL
    expect(computeSettingsDerived(out, "walkin", 30).cpl).toBeCloseTo(fwd.cpl, 6);
  });

  it("cpa mode recovers CPA 5 from the computed CPL", () => {
    const out = completeInputs("cpa", "walkin", {
      sales: 200000, aov: 3500, conv_rate: 60, respond_rate: 15, cpl: fwd.cpl,
    });
    expect(out.cpa_pct).toBeCloseTo(5, 4);
    expect(computeSettingsDerived(out, "walkin", 30).cpl).toBeCloseTo(fwd.cpl, 6);
  });

  it("visit_rate matches the sheet's consistent anchor (Couch Factory: CPL 14.5833 → 15%)", () => {
    const out = completeInputs("visit_rate", "walkin", {
      sales: 200000, aov: 3500, cpa_pct: 5, conv_rate: 60, cpl: 14.5833,
    });
    expect(out.respond_rate).toBeCloseTo(15, 1);
  });

  it("guards divide-by-zero (CPL 0 → 0, never NaN)", () => {
    const out = completeInputs("visit_rate", "walkin", {
      sales: 200000, aov: 3500, cpa_pct: 5, conv_rate: 60, cpl: 0,
    });
    expect(out.respond_rate).toBe(0);
    expect(Number.isNaN(out.respond_rate)).toBe(false);
  });
});

describe("completeInputs — appointment inverse calculators", () => {
  const base = {
    sales: 200000, aov: 3500, cpa_pct: 5, conv_rate: 60,
    showup_rate: 50, appt_rate: 80, respond_rate: 70,
  };
  const fwd = computeSettingsDerived(base, "appointment", 30);

  it("cpl mode returns the base inputs unchanged", () => {
    expect(completeInputs("cpl", "appointment", base)).toEqual(base);
  });

  it("appt_rate mode recovers Appointment Rate 80 from the computed CPL", () => {
    const out = completeInputs("appt_rate", "appointment", {
      sales: 200000, aov: 3500, cpa_pct: 5, conv_rate: 60,
      showup_rate: 50, respond_rate: 70, cpl: fwd.cpl,
    });
    expect(out.appt_rate).toBeCloseTo(80, 4);
    expect(computeSettingsDerived(out, "appointment", 30).cpl).toBeCloseTo(fwd.cpl, 6);
  });

  it("cpa mode recovers CPA 5 from the computed CPL", () => {
    const out = completeInputs("cpa", "appointment", {
      sales: 200000, aov: 3500, conv_rate: 60,
      showup_rate: 50, appt_rate: 80, respond_rate: 70, cpl: fwd.cpl,
    });
    expect(out.cpa_pct).toBeCloseTo(5, 4);
    expect(computeSettingsDerived(out, "appointment", 30).cpl).toBeCloseTo(fwd.cpl, 6);
  });
});
