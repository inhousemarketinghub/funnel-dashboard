import { describe, it, expect } from "vitest";
import { buildRows } from "./mom-table";
import { fmtRM } from "@/lib/utils";
import type { FunnelMetrics, KPIConfig, MoMResult } from "@/lib/types";

function metrics(over: Partial<FunnelMetrics>): FunnelMetrics {
  return {
    ad_spend: 0, lead_funnel_spend: 0, branding_spend: 0, inquiry: 0, contact: 0,
    appointment: 0, showup: 0, est_showup: 0, orders: 0, sales: 0,
    cpl: 0, respond_rate: 0, appt_rate: 0, showup_rate: 0, conv_rate: 0,
    aov: 0, roas: 0, cpa_pct: 0,
    ...over,
  };
}

const KPI_ZERO: KPIConfig = {
  sales: 0, orders: 0, aov: 0, cpl: 0, respond_rate: 0, appt_rate: 0,
  showup_rate: 0, conv_rate: 0, ad_spend: 0, daily_ad: 0, roas: 0, cpa_pct: 0,
  target_contact: 0, target_appt: 0, target_showup: 0,
};
const NO_MOM: MoMResult = {};

describe("MoMTable CPL", () => {
  // Regression: the comparison table once recomputed CPL as ad_spend/inquiry,
  // which uses the TOTAL spend (lead funnel + branding) and so diverged from the
  // KPI card's canonical CPL (lead funnel spend only). It must use tm.cpl.
  it("uses the canonical tm.cpl, not total ad_spend / inquiry", () => {
    // 2990's@Petaling Jaya, Sep 2026 real figures.
    const tm = metrics({ ad_spend: 15330.07, inquiry: 401, cpl: 37.31 });
    const lm = metrics({ ad_spend: 12485.33, inquiry: 287, cpl: 29.5 });

    const rows = buildRows(tm, lm, NO_MOM, KPI_ZERO, "walkin", "en");
    const cplRow = rows.find((r) => r.label === "CPL");

    expect(cplRow).toBeDefined();
    expect(cplRow!.tmFmt).toBe(fmtRM(37.31));           // lead-funnel CPL
    expect(cplRow!.tmFmt).not.toBe(fmtRM(15330.07 / 401)); // NOT 38.23 total-based
  });

  it("adds a Lead Funnel sub-row (CPL basis) right under Ad Spend when the split exists", () => {
    const tm = metrics({ ad_spend: 15330.07, lead_funnel_spend: 13851.96, branding_spend: 342.55, inquiry: 401, cpl: 37.31 });
    const lm = metrics({ ad_spend: 12485.33, lead_funnel_spend: 11000, branding_spend: 500, inquiry: 287, cpl: 29.5 });

    const rows = buildRows(tm, lm, NO_MOM, KPI_ZERO, "walkin", "en");
    const adIdx = rows.findIndex((r) => r.label === "Ad Spend");
    const lf = rows[adIdx + 1];

    expect(lf.label).toContain("Lead Funnel");
    expect(lf.tmFmt).toBe(fmtRM(13851.96 * 1.08)); // RM14,960 — matches CPL denominator
  });

  it("omits the Lead Funnel sub-row when there is no lead/branding split", () => {
    const tm = metrics({ ad_spend: 10000, lead_funnel_spend: 0, branding_spend: 0, inquiry: 200, cpl: 50 });
    const lm = metrics({ ad_spend: 8000, lead_funnel_spend: 0, branding_spend: 0, inquiry: 160, cpl: 50 });

    const rows = buildRows(tm, lm, NO_MOM, KPI_ZERO, "walkin", "en");
    expect(rows.find((r) => r.label.includes("Lead Funnel"))).toBeUndefined();
  });
});
