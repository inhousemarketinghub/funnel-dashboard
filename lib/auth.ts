import { createServerSupabase } from "./supabase/server";

export type UserRole = "owner" | "user" | null;

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
    role: (agency?.role as UserRole) || "user",
    agencyId: agency?.id || null,
  };
}
