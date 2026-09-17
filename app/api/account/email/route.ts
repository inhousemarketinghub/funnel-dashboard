import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// POST { newEmail, currentPassword } — change the signed-in user's login email.
//
// The email is this app's identity anchor: getUserRole() looks agencies up BY
// email, and project_access hangs off agencies.id. So we change the auth email
// AND rewrite agencies.email on the SAME row in one shot — the id never moves,
// so the member keeps every project assignment. Current password is verified
// first (on a throwaway client that never touches the session cookies).
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const newEmail = typeof body?.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (newEmail === user.email.toLowerCase()) {
    return NextResponse.json({ error: "That is already your email" }, { status: 400 });
  }

  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: pwErr } = await verifier.auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (pwErr) return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });

  const admin = createAdminSupabase();
  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, { email: newEmail, email_confirm: true });
  if (authErr) {
    const msg = /already|registered|exists/i.test(authErr.message) ? "That email is already in use" : authErr.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { error: agErr } = await admin.from("agencies").update({ email: newEmail }).eq("email", user.email);
  if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, email: newEmail });
}
