import { describe, it, expect } from "vitest";
import { monthRange } from "./report-audit";

describe("monthRange", () => {
  it("regular month", () => {
    expect(monthRange(2026, 9)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
  });
  it("February in a non-leap and a leap year", () => {
    expect(monthRange(2026, 2).end).toBe("2026-02-28");
    expect(monthRange(2028, 2).end).toBe("2028-02-29");
  });
  it("December stays inside the year", () => {
    expect(monthRange(2026, 12)).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
});
