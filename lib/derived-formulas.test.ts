import { describe, it, expect } from "vitest";
import { describeDerived } from "./derived-formulas";

// Values mirror the sheet's walk-in stimulator at Sales 200000 (The Couch Factory
// column). Intermediates are full precision — the tooltip shows the decimals and
// the rounded headline so "634.92 ≈ 635" explains why FB Leads reads 635, not 633.
const walkinForm = {
  sales: 200000,
  aov: 3500,
  cpa_pct: 5,
  conv_rate: 60,
  respond_rate: 15, // labelled "Targeted Visit Rate" for walk-in
};

const walkinDerived = {
  orders: 200000 / 3500,
  monthly_ad_incl: 10000,
  monthly_ad_excl: 10000 / 1.08,
  target_visit: 200000 / 3500 / 0.6,
  fb_leads: 200000 / 3500 / 0.6 / 0.15,
  cpl: 10000 / 1.08 / (200000 / 3500 / 0.6 / 0.15),
  cp_acquisition: 10000 / 1.08 / (200000 / 3500),
  cp_visit: 10000 / 1.08 / (200000 / 3500 / 0.6),
  daily_ad_targeted_incl: 10000 / 30,
  daily_ad_targeted_excl: 10000 / 1.08 / 30,
  days_in_month: 30,
};

describe("describeDerived — walk-in funnel", () => {
  it("explains CPL with full-precision FB Leads plugged in", () => {
    expect(describeDerived("cpl", walkinForm, "walkin", walkinDerived)).toEqual({
      title: "CPL (Incl SST)",
      formula: "Monthly Ad Spend (Excl SST) ÷ FB Leads Inquiry",
      substituted: "RM9,259.26 ÷ 634.92",
      result: "RM14.58",
    });
  });

  it("explains Monthly Ad Spend (Incl SST) as Sales × CPA%", () => {
    expect(describeDerived("monthly_ad_incl", walkinForm, "walkin", walkinDerived)).toEqual({
      title: "Monthly Ad Spend (Incl SST)",
      formula: "Targeted Sales × Targeted CPA",
      substituted: "RM200,000.00 × 5%",
      result: "RM10,000.00",
    });
  });

  it("explains Monthly Ad Spend (Excl SST) as a tax divide by 1.08", () => {
    expect(describeDerived("monthly_ad_excl", walkinForm, "walkin", walkinDerived)).toEqual({
      title: "Monthly Ad Spend (Excl SST)",
      formula: "Monthly Ad Spend (Incl SST) ÷ 1.08",
      substituted: "RM10,000.00 ÷ 1.08",
      result: "RM9,259.26",
    });
  });

  it("explains Visit and shows the rounding (95.24 ≈ 95)", () => {
    expect(describeDerived("target_visit", walkinForm, "walkin", walkinDerived)).toEqual({
      title: "Visit",
      formula: "Targeted Order ÷ Targeted Conversion Rate",
      substituted: "57.14 ÷ 60%",
      result: "95.24 ≈ 95",
    });
  });

  it("explains FB Leads (walk-in) and shows why it rounds to 635", () => {
    expect(describeDerived("fb_leads", walkinForm, "walkin", walkinDerived)).toEqual({
      title: "FB Leads Inquiry",
      formula: "Visit ÷ Targeted Visit Rate",
      substituted: "95.24 ÷ 15%",
      result: "634.92 ≈ 635",
    });
  });

  it("explains CP.Acquisition as Ad Spend ÷ Order", () => {
    expect(describeDerived("cp_acquisition", walkinForm, "walkin", walkinDerived)).toEqual({
      title: "CP.Acquisition (Incl SST)",
      formula: "Monthly Ad Spend (Excl SST) ÷ Targeted Order",
      substituted: "RM9,259.26 ÷ 57.14",
      result: "RM162.04",
    });
  });

  it("explains Targeted Daily Ad Spend with days in month", () => {
    expect(describeDerived("daily_ad_targeted_incl", walkinForm, "walkin", walkinDerived)).toEqual({
      title: "Targeted Daily Ad Spend (Incl SST)",
      formula: "Monthly Ad Spend (Incl SST) ÷ Days in Month",
      substituted: "RM10,000.00 ÷ 30",
      result: "RM333.33",
    });
  });

  it("returns null for an unknown key", () => {
    expect(describeDerived("nonsense", walkinForm, "walkin", walkinDerived)).toBeNull();
  });
});

// Appointment funnel exercises the deeper pipeline branch (Show Up → Appointment → Contact)
const apptForm = {
  sales: 200000,
  aov: 3500,
  cpa_pct: 5,
  conv_rate: 60,
  showup_rate: 50,
  appt_rate: 80,
  respond_rate: 70,
};

const apptDerived = {
  orders: 200000 / 3500,
  monthly_ad_excl: 10000 / 1.08,
  target_showup: 200000 / 3500 / 0.6,
  target_appt: 200000 / 3500 / 0.6 / 0.5,
  target_contact: 200000 / 3500 / 0.6 / 0.5 / 0.8,
  fb_leads: 200000 / 3500 / 0.6 / 0.5 / 0.8 / 0.7,
};

describe("describeDerived — appointment funnel", () => {
  it("explains Appointment as Show Up ÷ Show Up Rate", () => {
    expect(describeDerived("target_appt", apptForm, "appointment", apptDerived)).toEqual({
      title: "Appointment",
      formula: "Show Up ÷ Targeted Show Up Rate",
      substituted: "95.24 ÷ 50%",
      result: "190.48 ≈ 190",
    });
  });

  it("explains FB Leads (appointment) as Contact Given ÷ Respond Rate", () => {
    expect(describeDerived("fb_leads", apptForm, "appointment", apptDerived)).toEqual({
      title: "FB Leads Inquiry",
      formula: "Contact Given ÷ Targeted Respond Rate",
      substituted: "238.10 ÷ 70%",
      result: "340.14 ≈ 340",
    });
  });
});
