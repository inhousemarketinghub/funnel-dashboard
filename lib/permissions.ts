import type { MemberRole } from "./types";

type Permission =
  | "view_dashboard"
  | "view_report"
  | "edit_settings"
  | "manage_team"
  | "create_client"
  | "view_overview"
  | "view_activity_log";

export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  owner: [
    "view_dashboard", "view_report", "edit_settings",
    "manage_team", "create_client", "view_overview", "view_activity_log",
  ],
  manager: [
    "view_dashboard", "view_report", "edit_settings",
    "view_overview", "view_activity_log",
  ],
  viewer: [
    "view_dashboard", "view_report",
  ],
};

function hasPermission(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canEditSettings(role: MemberRole): boolean {
  return hasPermission(role, "edit_settings");
}

export function canManageTeam(role: MemberRole): boolean {
  return hasPermission(role, "manage_team");
}

export function canCreateClient(role: MemberRole): boolean {
  return hasPermission(role, "create_client");
}

export function canViewOverview(role: MemberRole): boolean {
  return hasPermission(role, "view_overview");
}
