import { describe, it, expect } from "vitest";
import { effectiveVersionAsOf, versionsInRange, diffSnapshots, monthStartsBetween } from "./kpi-history";
import type { KpiTargetVersion, KPIConfig } from "./types";

function snap(over: Partial<KPIConfig>): KPIConfig {
  return { sales: 0, orders: 0, aov: 0, cpl: 0, respond_rate: 0, appt_rate: 0,
    showup_rate: 0, conv_rate: 0, ad_spend: 0, daily_ad: 0, roas: 0, cpa_pct: 0,
    target_contact: 0, target_appt: 0, target_showup: 0, ...over };
}
function v(id: string, iso: string, over: Partial<KPIConfig>): KpiTargetVersion {
  return { id, client_id: "c", brand: "", effective_from: iso, snapshot: snap(over), source: "save", changed_by: null };
}
const vs = [
  v("1", "2026-07-01T00:00:00Z", { ad_spend: 3000 }),
  v("2", "2026-09-01T10:00:00Z", { ad_spend: 3000 }),
  v("3", "2026-09-15T14:00:00Z", { ad_spend: 5000 }),
];

describe("effectiveVersionAsOf", () => {
  it("returns the latest version at or before asOf", () => {
    expect(effectiveVersionAsOf(vs, new Date("2026-09-30T23:59:59Z"))?.id).toBe("3");
  });
  it("carries forward across gap months (Aug has no version → July's)", () => {
    expect(effectiveVersionAsOf(vs, new Date("2026-08-31T23:59:59Z"))?.id).toBe("1");
  });
  it("returns null before the first version", () => {
    expect(effectiveVersionAsOf(vs, new Date("2026-06-01T00:00:00Z"))).toBeNull();
  });
});

describe("versionsInRange", () => {
  it("includes the carry-in version plus any changes inside the range", () => {
    const got = versionsInRange(vs, new Date("2026-09-01T00:00:00Z"), new Date("2026-09-30T23:59:59Z")).map((x) => x.id);
    expect(got).toEqual(["2", "3"]); // #2 effective at start, #3 mid-month change
  });
});

describe("diffSnapshots", () => {
  it("lists only changed fields with from/to", () => {
    const d = diffSnapshots(snap({ ad_spend: 3000, cpa_pct: 8 }), snap({ ad_spend: 5000, cpa_pct: 8 }));
    expect(d).toEqual([{ key: "ad_spend", from: 3000, to: 5000 }]);
  });
  it("prev null → all non-zero fields are 'from null' (initial set)", () => {
    const d = diffSnapshots(null, snap({ ad_spend: 3000 }));
    expect(d).toEqual([{ key: "ad_spend", from: null, to: 3000 }]);
  });
});

describe("monthStartsBetween", () => {
  it("lists UTC month-starts inclusive", () => {
    const got = monthStartsBetween(new Date("2026-07-15T00:00:00Z"), new Date("2026-10-02T00:00:00Z"))
      .map((d) => d.toISOString().slice(0, 7));
    expect(got).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
  });
});
