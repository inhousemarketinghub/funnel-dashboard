import { describe, it, expect } from "vitest";
import { buildClientDigest, detectCplAnomaly } from "./notify";
import type { DailyMetric } from "./types";

const D = (over: Partial<DailyMetric>): DailyMetric => ({
  date: new Date(2026, 8, 6), ad_spend: 100, lead_funnel_spend: 0, branding_spend: 0,
  inquiry: 10, contact: 5, appointment: 3, est_showup: 2, showup: 2, orders: 1, sales: 1000,
  ...over,
});

describe("buildClientDigest severity", () => {
  const base = { syncStatus: "success" as const, changes: { count: 0, months: [] }, quarantineAdded: 0, anomaly: null, sanity: [] };
  it("quiet day → info", () => {
    expect(buildClientDigest(base).severity).toBe("info");
  });
  it("changes alone stay info (normal operations)", () => {
    expect(buildClientDigest({ ...base, changes: { count: 7, months: ["2026-09"] } }).severity).toBe("info");
  });
  it("quarantine / sanity / anomaly / kpi error → warn", () => {
    expect(buildClientDigest({ ...base, quarantineAdded: 1 }).severity).toBe("warn");
    expect(buildClientDigest({ ...base, sanity: ["orders_exceed_showup"] }).severity).toBe("warn");
    expect(buildClientDigest({ ...base, anomaly: { metric: "cpl", value: 60, baseline: 20 } }).severity).toBe("warn");
    expect(buildClientDigest({ ...base, kpiError: "503" }).severity).toBe("warn");
  });
  it("sync failure trumps everything → error", () => {
    expect(buildClientDigest({ ...base, syncStatus: "error", syncError: "503", anomaly: { metric: "cpl", value: 60, baseline: 20 } }).severity).toBe("error");
    expect(buildClientDigest({ ...base, syncStatus: "missing" }).severity).toBe("error");
  });
});

describe("detectCplAnomaly", () => {
  const baseline = Array.from({ length: 30 }, (_, i) => D({ date: new Date(2026, 7, i + 1), ad_spend: 100, inquiry: 10 })); // CPL 10
  it("flags a >1.5x spike", () => {
    const y = [D({ ad_spend: 200, inquiry: 10 })]; // CPL 20
    expect(detectCplAnomaly(y, baseline, "walkin")).toMatchObject({ metric: "cpl", value: 20, baseline: 10 });
  });
  it("small-denominator guard: inquiry < 5 never cries wolf", () => {
    const y = [D({ ad_spend: 200, inquiry: 3 })];
    expect(detectCplAnomaly(y, baseline, "walkin")).toBeNull();
  });
  it("within range → null; empty inputs → null", () => {
    expect(detectCplAnomaly([D({ ad_spend: 120, inquiry: 10 })], baseline, "walkin")).toBeNull();
    expect(detectCplAnomaly([], baseline, "walkin")).toBeNull();
  });
});
