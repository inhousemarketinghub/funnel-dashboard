import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if user is approved (exists in agencies table)
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: agency } = await supabase
          .from("agencies")
          .select("id, role")
          .eq("email", user.email)
          .single();

        if (agency) {
          // Approved user → go to clients
          return NextResponse.redirect(`${origin}/clients`);
        } else {
          // Not approved → show pending page
          return NextResponse.redirect(`${origin}/pending`);
        }
      }
    }
  }

  // Auth error → back to login
  return NextResponse.redirect(`${origin}/login`);
}
