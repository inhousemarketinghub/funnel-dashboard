import { describe, it, expect } from "vitest";
import { accessCountLabel, accessPreview, roleDescription, teamRoleSummary } from "./team-summary";

describe("accessCountLabel", () => {
  it("reads naturally for 0, 1, many", () => {
    expect(accessCountLabel(0)).toBe("No clients assigned");
    expect(accessCountLabel(1)).toBe("1 client");
    expect(accessCountLabel(6)).toBe("6 clients");
  });
});

describe("accessPreview", () => {
  it("keeps the first N names and counts the rest", () => {
    const r = accessPreview([{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }, { name: "E" }], 3);
    expect(r.names).toEqual(["A", "B", "C"]);
    expect(r.more).toBe(2);
  });
  it("no overflow when within the limit", () => {
    const r = accessPreview([{ name: "A" }, { name: "B" }], 3);
    expect(r.names).toEqual(["A", "B"]);
    expect(r.more).toBe(0);
  });
});

describe("roleDescription", () => {
  it("explains each role in one line", () => {
    expect(roleDescription("manager")).toMatch(/edit/i);
    expect(roleDescription("viewer")).toMatch(/view only/i);
    expect(roleDescription("owner")).toMatch(/full access/i);
  });
});

describe("teamRoleSummary", () => {
  it("counts members and roles, omitting empty roles", () => {
    expect(teamRoleSummary([{ role: "owner" }, { role: "manager" }, { role: "manager" }]))
      .toBe("3 members · 1 Owner · 2 Manager");
  });
  it("handles a single member", () => {
    expect(teamRoleSummary([{ role: "owner" }])).toBe("1 member · 1 Owner");
  });
  it("handles empty", () => {
    expect(teamRoleSummary([])).toBe("0 members");
  });
});
