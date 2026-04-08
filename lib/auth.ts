import { createServerSupabase } from "./supabase/server";
import type { MemberRole } from "./types";

export type UserRole = "owner" | "user" | null;

const ALL_PERMISSIONS = ["view_dashboard", "view_report", "edit_settings", "manage_access"];

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

  // Backwards compatible: if role column doesn't exist yet (pre-migration),
  // anyone with an agency record is treated as owner
  const isOwner = agency.role === "owner" || !agency.role;

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
    .select("permissions")
    .eq("client_id", clientId)
    .eq("agency_id", agencyId)
    .single();

  return (data?.permissions as string[]) || ["view_dashboard"];
}
