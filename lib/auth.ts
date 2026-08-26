import { createServerSupabase } from "./supabase/server";
import type { MemberRole } from "./types";

export type UserRole = "owner" | "user" | null;

// Feature keys — one per gated surface. view_dashboard is implicit for anyone
// assigned to a project; the rest come from the member's role checklist
// (roles.permissions) editable in Manage Access → Roles.
export const FEATURE_KEYS = [
  "view_dashboard",
  "view_trends",
  "view_report",
  "view_projection",
  "save_projection",
  "edit_customization",
  "view_diagnostics",
  "edit_settings",
  "manage_access",
] as const;
const ALL_PERMISSIONS = [...FEATURE_KEYS];

export async function getUserRole(): Promise<{ email: string | null; role: UserRole; agencyId: string | null; memberRole: MemberRole | null }> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { email: null, role: null, agencyId: null, memberRole: null };

  const { data: agency } = await supabase
    .from("agencies")
    .select("id, role")
    .eq("email", user.email)
    .single();

  if (!agency?.id) {
    return {
      email: user.email,
      role: "user" as UserRole,
      agencyId: null,
      memberRole: null,
    };
  }

  // Check owner status: explicit role, or legacy records where role was never set
  // (pre-migration agencies that own clients are treated as owners)
  let isOwner = agency.role === "owner";
  if (!isOwner && !agency.role) {
    const { data: ownedClients } = await supabase
      .from("clients")
      .select("id")
      .eq("agency_id", agency.id)
      .limit(1);
    isOwner = (ownedClients?.length ?? 0) > 0;
  }

  let memberRole: MemberRole | null = null;
  if (isOwner) {
    memberRole = "owner";
  } else {
    const { data: access } = await supabase
      .from("project_access")
      .select("role")
      .eq("agency_id", agency.id)
      .limit(1)
      .single();

    memberRole = (access?.role as MemberRole | undefined) ?? "viewer";
  }

  return {
    email: user.email,
    role: (isOwner ? "owner" : "user") as UserRole,
    agencyId: agency.id,
    memberRole,
  };
}

export async function getProjectPermissions(clientId: string): Promise<string[]> {
  const { role, agencyId } = await getUserRole();
  if (role === "owner") return ALL_PERMISSIONS;
  if (!agencyId) return [];

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("project_access")
    .select("permissions, role_id, roles(permissions)")
    .eq("client_id", clientId)
    .eq("agency_id", agencyId)
    .single();

  if (!data) return ["view_dashboard"];

  // Role-based resolution: the member's role defines their feature checklist.
  const rolePerms = (data.roles as { permissions?: unknown } | null)?.permissions;
  if (Array.isArray(rolePerms)) {
    return ["view_dashboard", ...rolePerms.filter((p): p is string => typeof p === "string")];
  }

  // Legacy fallback (rows created before the roles migration): the old flat
  // permission array, extended so pre-roles semantics keep working — trends
  // was never gated, and edit_settings implied every admin surface.
  const legacy = (data.permissions as string[]) || [];
  const out = new Set<string>(["view_dashboard", "view_trends", ...legacy]);
  if (legacy.includes("edit_settings")) {
    for (const k of ["view_projection", "save_projection", "edit_customization", "view_diagnostics"]) out.add(k);
  }
  return [...out];
}
