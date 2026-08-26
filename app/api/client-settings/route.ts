import { NextRequest, NextResponse } from "next/server";
import { getUserRole, getProjectPermissions } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

// PUT /api/client-settings { clientId, name } — rename the project.
// Same permission model as the Settings page (edit_settings); service-role
// write because the clients UPDATE RLS policy is owner-only while managers
// legitimately manage project settings.
export async function PUT(req: NextRequest) {
  const { role } = await getUserRole();
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clientId = body?.clientId;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  if (!name || name.length > 80) {
    return NextResponse.json({ error: "Name must be 1-80 characters" }, { status: 400 });
  }

  const perms = await getProjectPermissions(clientId);
  if (!perms.includes("edit_settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createAdminSupabase();
  const { error } = await db.from("clients").update({ name }).eq("id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, name });
}
