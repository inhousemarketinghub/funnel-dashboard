import { createServerSupabase } from "./supabase/server";

export type UserRole = "owner" | "user" | null;

const ALL_PERMISSIONS = ["view_dashboard", "view_report", "edit_settings", "manage_access"];

export async function getUserRole(): Promise<{ email: string | null; role: UserRole; agencyId: string | null }> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { email: null, role: null, agencyId: null };

  const { data: agency } = await supabase
    .from("agencies")
    .select("id, role")
    .eq("email", user.email)
    .single();

  return {
    email: user.email,
    role: (agency?.role === "owner" ? "owner" : "user") as UserRole,
    agencyId: agency?.id || null,
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
