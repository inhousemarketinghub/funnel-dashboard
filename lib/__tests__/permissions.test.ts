import { describe, it, expect } from "vitest";
import { canEditSettings, canManageTeam, canCreateClient, canViewOverview, ROLE_PERMISSIONS } from "../permissions";
import type { MemberRole } from "../types";

describe("ROLE_PERMISSIONS", () => {
  it("owner has all permissions", () => {
    expect(ROLE_PERMISSIONS.owner).toContain("view_dashboard");
    expect(ROLE_PERMISSIONS.owner).toContain("edit_settings");
    expect(ROLE_PERMISSIONS.owner).toContain("manage_team");
    expect(ROLE_PERMISSIONS.owner).toContain("create_client");
    expect(ROLE_PERMISSIONS.owner).toContain("view_overview");
  });

  it("manager can edit settings but not manage team", () => {
    expect(ROLE_PERMISSIONS.manager).toContain("view_dashboard");
    expect(ROLE_PERMISSIONS.manager).toContain("edit_settings");
    expect(ROLE_PERMISSIONS.manager).toContain("view_overview");
    expect(ROLE_PERMISSIONS.manager).not.toContain("manage_team");
    expect(ROLE_PERMISSIONS.manager).not.toContain("create_client");
  });

  it("viewer can only view dashboard", () => {
    expect(ROLE_PERMISSIONS.viewer).toContain("view_dashboard");
    expect(ROLE_PERMISSIONS.viewer).not.toContain("edit_settings");
    expect(ROLE_PERMISSIONS.viewer).not.toContain("manage_team");
    expect(ROLE_PERMISSIONS.viewer).not.toContain("view_overview");
  });
});

describe("permission helpers", () => {
  it("canEditSettings returns true for owner and manager", () => {
    expect(canEditSettings("owner")).toBe(true);
    expect(canEditSettings("manager")).toBe(true);
    expect(canEditSettings("viewer")).toBe(false);
  });

  it("canManageTeam returns true only for owner", () => {
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageTeam("manager")).toBe(false);
    expect(canManageTeam("viewer")).toBe(false);
  });

  it("canCreateClient returns true only for owner", () => {
    expect(canCreateClient("owner")).toBe(true);
    expect(canCreateClient("manager")).toBe(false);
    expect(canCreateClient("viewer")).toBe(false);
  });

  it("canViewOverview returns true for owner and manager", () => {
    expect(canViewOverview("owner")).toBe(true);
    expect(canViewOverview("manager")).toBe(true);
    expect(canViewOverview("viewer")).toBe(false);
  });
});
