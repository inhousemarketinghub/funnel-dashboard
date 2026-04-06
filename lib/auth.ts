import { createServerSupabase } from "./supabase/server";

export type UserRole = "admin" | "viewer" | null;

export async function getUserRole(): Promise<{ email: string | null; role: UserRole }> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { email: null, role: null };

  const { data: agency } = await supabase
    .from("agencies")
    .select("role")
    .eq("email", user.email)
    .single();

  return {
    email: user.email,
    role: (agency?.role as UserRole) || null,
  };
}
