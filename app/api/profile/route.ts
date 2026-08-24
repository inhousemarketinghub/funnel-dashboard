import { NextRequest, NextResponse } from "next/server";
import { getUserRole, getProjectPermissions } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { parseProfile } from "@/lib/profile";

// PUT /api/profile { clientId, profile } — save the client's 项目档案.
// Permission model matches the Settings page (edit_settings: owner OR manager);
// the write uses the service role because the clients UPDATE RLS policy is
// owner-only, and managers legitimately edit profiles. parseProfile re-validates
// server-side so nothing unvetted lands in the JSONB.
export async function PUT(req: NextRequest) {
  const { role } = await getUserRole();
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clientId = body?.clientId;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const perms = await getProjectPermissions(clientId);
  if (!perms.includes("edit_settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = parseProfile(body?.profile);
  const db = createAdminSupabase();
  const { error } = await db.from("clients").update({ profile }).eq("id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profile });
}
