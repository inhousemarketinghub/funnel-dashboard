import { NextResponse } from "next/server";
import { getUserRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

// GET /api/notifications — last 14 days of digests. The session client reads
// under RLS, so each member only ever sees clients they have access to; no
// filtering code needed here.
export async function GET() {
  try {
    const { role, email } = await getUserRole();
    if (!role || !email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = await createServerSupabase();
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const [itemsRes, seenRes] = await Promise.all([
      supabase.from("notifications")
        .select("id, day, severity, body, created_at, clients(name)")
        .gte("day", since)
        .order("day", { ascending: false })
        .order("severity", { ascending: false })
        .limit(200),
      supabase.from("user_states").select("notifications_seen_at").maybeSingle(),
    ]);
    if (itemsRes.error) throw new Error(itemsRes.error.message);

    return NextResponse.json({
      items: itemsRes.data ?? [],
      seenAt: seenRes.data?.notifications_seen_at ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/notifications — mark everything seen for the current user.
// user_states RLS (own-email FOR ALL) scopes the upsert.
export async function POST() {
  try {
    const { role, email } = await getUserRole();
    if (!role || !email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = await createServerSupabase();
    const { error } = await supabase.from("user_states").upsert(
      { email: email.toLowerCase(), notifications_seen_at: new Date().toISOString() },
      { onConflict: "email" },
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark seen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
