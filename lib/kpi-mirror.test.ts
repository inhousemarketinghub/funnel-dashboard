import { describe, it, expect } from "vitest";
import { extractKPIMirror, combineKPI } from "./sheets";
import { pickKPIMirrorEntry } from "./data-source";
import type { KPIConfig } from "./types";

const pad = (cells: Record<number, string>, len = 16): string[] => {
  const row = Array.from({ length: len }, () => "");
  for (const [i, v] of Object.entries(cells)) row[Number(i)] = v;
  return row;
};

describe("extractKPIMirror", () => {
  it("single-brand tab (no section headers) → one entry under brand ''", () => {
    const rows = [
      pad({ 3: "KPI Stimulator (Targeted CPL)" }),
      pad({ 3: "Targeted Sales", 4: "RM300,000", 5: "AOV", 6: "RM50,000", 7: "Order", 8: "6" }),
      pad({ 3: "Targeted CPA %", 4: "2.5%" }),
      pad({ 3: "CPL", 4: "RM26", 5: "FB Leads", 6: "1270" }),
    ];
    const out = extractKPIMirror(rows);
    expect(out).toHaveLength(1);
    expect(out[0].brand).toBe("");
    expect(out[0].position).toBe(0);
    expect(out[0].kpi).toMatchObject({ sales: 300000, aov: 50000, orders: 6, cpa_pct: 2.5, cpl: 26 });
    expect(out[0].derived).toMatchObject({ cpl: 26, fb_leads: 1270 });
  });

  it("multi-brand sections parse per offset, in header order", () => {
    const rows = [
      pad({ 3: "Alpha - KPI Stimulator (Targeted CPL)", 10: "Beta - KPI Stimulator (Targeted CPL)" }),
      pad({ 3: "Targeted Sales", 4: "RM100", 10: "Targeted Sales", 11: "RM200" }),
    ];
    const out = extractKPIMirror(rows);
    expect(out.map((e) => [e.brand, e.position, e.kpi.sales])).toEqual([
      ["Alpha", 0, 100],
      ["Beta", 1, 200],
    ]);
  });
});

describe("pickKPIMirrorEntry", () => {
  const entries = extractKPIMirror([
    pad({ 3: "Alpha - KPI Stimulator", 10: "Beta - KPI Stimulator" }),
    pad({ 3: "Targeted Sales", 4: "RM100", 10: "Targeted Sales", 11: "RM200" }),
  ]);
  it("exact brand match, case-insensitive", () => {
    expect(pickKPIMirrorEntry(entries, "beta")?.kpi.sales).toBe(200);
  });
  it("a lone section serves any brand ask (parser default-offset parity)", () => {
    const single = extractKPIMirror([pad({ 3: "KPI Stimulator" }), pad({ 3: "Targeted Sales", 4: "RM77" })]);
    expect(pickKPIMirrorEntry(single, "Rygis")?.kpi.sales).toBe(77);
  });
});

describe("combineKPI", () => {
  const K = (over: Partial<KPIConfig>): KPIConfig => ({
    sales: 0, orders: 0, aov: 0, cpl: 0, respond_rate: 0, appt_rate: 0,
    showup_rate: 0, conv_rate: 0, ad_spend: 0, daily_ad: 0, roas: 0,
    cpa_pct: 0, target_contact: 0, target_appt: 0, target_showup: 0, ...over,
  });
  it("sums the volume fields, averages the rates", () => {
    const out = combineKPI([K({ sales: 100, aov: 10, roas: 4 }), K({ sales: 200, aov: 30, roas: 8 })]);
    expect(out.sales).toBe(300);
    expect(out.aov).toBe(20);
    expect(out.roas).toBe(6);
  });
  it("empty input → all-zero config", () => {
    expect(combineKPI([]).sales).toBe(0);
  });
});
