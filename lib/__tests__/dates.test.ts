import { describe, it, expect } from "vitest";
import { getMondayOf, getSundayOf } from "../dates";

describe("getMondayOf", () => {
  it("returns same date when input is Monday", () => {
    const mon = new Date(2026, 3, 20); // Apr 20 2026 is a Monday
    const result = getMondayOf(mon);
    expect(result.getTime()).toBe(mon.getTime());
  });

  it("returns previous Monday when input is mid-week", () => {
    const wed = new Date(2026, 3, 22); // Apr 22 2026 is a Wednesday
    const result = getMondayOf(wed);
    expect(result).toEqual(new Date(2026, 3, 20));
  });

  it("returns previous Monday when input is Sunday", () => {
    const sun = new Date(2026, 3, 26); // Apr 26 2026 is a Sunday
    const result = getMondayOf(sun);
    expect(result).toEqual(new Date(2026, 3, 20));
  });

  it("handles year boundary: Jan 1 2026 (Thursday) → Dec 29 2025 (Monday)", () => {
    const jan1 = new Date(2026, 0, 1);
    const result = getMondayOf(jan1);
    expect(result).toEqual(new Date(2025, 11, 29));
  });
});

describe("getSundayOf", () => {
  it("returns same date when input is Sunday", () => {
    const sun = new Date(2026, 3, 26);
    const result = getSundayOf(sun);
    expect(result.getTime()).toBe(sun.getTime());
  });

  it("returns next Sunday when input is mid-week", () => {
    const wed = new Date(2026, 3, 22);
    const result = getSundayOf(wed);
    expect(result).toEqual(new Date(2026, 3, 26));
  });

  it("returns following Sunday when input is Monday", () => {
    const mon = new Date(2026, 3, 20);
    const result = getSundayOf(mon);
    expect(result).toEqual(new Date(2026, 3, 26));
  });
});
