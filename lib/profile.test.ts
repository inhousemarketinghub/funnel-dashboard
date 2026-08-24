import { describe, it, expect } from "vitest";
import { parseProfile, dataSourceOf } from "./profile";

describe("parseProfile", () => {
  it("garbage in → empty profile out", () => {
    for (const bad of [null, undefined, 42, "x", [], { funnel_type: "banana" }]) {
      expect(parseProfile(bad)).toEqual({});
    }
  });

  it("passes valid fields through and normalizes aliases to lowercase", () => {
    const p = parseProfile({
      funnel_type: "appointment",
      paid_sources: ["Facebook", " Instagram ", ""],
      column_aliases: { orders: ["Signed Up"], sales: [], bogus: ["x"] },
      data_source: "db",
    });
    expect(p).toEqual({
      funnel_type: "appointment",
      paid_sources: ["Facebook", "Instagram"],
      column_aliases: { orders: ["signed up"] },
      data_source: "db",
    });
  });

  it("drops unknown keys entirely", () => {
    expect(parseProfile({ hack: true, funnel_type: "walkin" })).toEqual({ funnel_type: "walkin" });
  });

  it("data_source defaults to sheets", () => {
    expect(dataSourceOf({})).toBe("sheets");
    expect(dataSourceOf({ data_source: "db" })).toBe("db");
  });
});
