import { describe, it, expect } from "vitest";
import { fmtRM, fmtPct, fmtROAS, pct, momPct, kpiColorClass } from "./utils";

describe("fmtRM", () => {
  it("formats ringgit values", () => {
    expect(fmtRM(291220.5)).toBe("RM291,220.50");
    expect(fmtRM(0)).toBe("RM0.00");
    expect(fmtRM(25.23)).toBe("RM25.23");
  });
});

describe("fmtPct", () => {
  it("formats percentages", () => {
    expect(fmtPct(44.0)).toBe("44.0%");
    expect(fmtPct(null)).toBe("N/A");
  });
});

describe("fmtROAS", () => {
  it("formats ROAS multiplier", () => {
    expect(fmtROAS(36.5)).toBe("36.5x");
  });
});

describe("pct", () => {
  it("computes percentage", () => {
    expect(pct(8, 4)).toBe(200);
    expect(pct(0, 0)).toBe(0);
  });
});

describe("momPct", () => {
  it("computes MoM percentage change", () => {
    expect(momPct(316, 198)).toBeCloseTo(59.6, 1);
    expect(momPct(100, 0)).toBeNull();
  });
});

describe("kpiColorClass", () => {
  it("returns blue for above KPI", () => {
    expect(kpiColorClass(44, 30, false)).toBe("text-[var(--blue)]");
  });
  it("returns red for below KPI", () => {
    expect(kpiColorClass(19.4, 33, false)).toBe("text-[var(--red)]");
  });
  it("returns blue for inverted below KPI", () => {
    expect(kpiColorClass(25, 26, true)).toBe("text-[var(--blue)]");
  });
});
