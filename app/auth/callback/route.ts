import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        // Auto-create agency if not exists
        const { data: agency } = await supabase
          .from("agencies")
          .select("id")
          .eq("email", user.email)
          .single();

        if (!agency) {
          await supabase.from("agencies").insert({
            email: user.email,
            name: user.user_metadata?.full_name || user.email.split("@")[0],
          });
        }

        return NextResponse.redirect(`${origin}/clients`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
