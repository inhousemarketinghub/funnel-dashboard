import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// PUT /api/account { name?, phone?, avatarUrl? } — the signed-in user edits
// their OWN profile row in `agencies`. We resolve the row from the session
// email (never a client-supplied id) and write with the service role because
// the agencies UPDATE policy is owner-scoped, while every member must be able
// to edit their own name/phone/avatar. avatarUrl accepts "" to clear it.
export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const update: Record<string, string | null> = {};

  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) {
      return NextResponse.json({ error: "Name must be 1–80 characters" }, { status: 400 });
    }
    update.name = name;
  }

  if (body?.phone !== undefined) {
    const raw = typeof body.phone === "string" ? body.phone.trim() : "";
    if (raw.length > 30) {
      return NextResponse.json({ error: "Phone number is too long" }, { status: 400 });
    }
    // Digits, spaces, and the usual separators only — reject anything else so a
    // stray paste can't smuggle markup into a field we render verbatim.
    if (raw && !/^[0-9+\-()\s]+$/.test(raw)) {
      return NextResponse.json({ error: "Phone can only contain digits and + - ( )" }, { status: 400 });
    }
    update.phone = raw || null;
  }

  if (body?.avatarUrl !== undefined) {
    const url = typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : "";
    update.avatar_url = url || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const db = createAdminSupabase();
  const { error } = await db.from("agencies").update(update).eq("email", user.email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...update });
}
