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

        // After existing logic, handle invite token
        const requestUrl = new URL(request.url);
        const inviteToken = requestUrl.searchParams.get("invite");
        if (inviteToken) {
          await fetch(`${origin}/api/invitations/${inviteToken}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        }

        // Honor a relative ?next= (the password-reset flow points it at the
        // set-new-password page). Reject absolute/protocol-relative URLs so the
        // callback can't be turned into an open redirect.
        const nextParam = requestUrl.searchParams.get("next");
        const dest = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/projects";
        return NextResponse.redirect(new URL(dest, origin));
      }
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
