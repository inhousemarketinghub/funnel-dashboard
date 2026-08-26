import { NextRequest, NextResponse } from "next/server";
import { getUserRole } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

// Role definitions API — owner only (roles are global; a role edit changes
// what every member holding it can do). Writes use the service role (the
// roles table has a read-only RLS policy).

const VALID_KEYS = new Set([
  "view_trends", "view_report", "view_projection", "save_projection",
  "edit_customization", "view_diagnostics", "edit_settings", "manage_access",
]);

function cleanPermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((p): p is string => typeof p === "string" && VALID_KEYS.has(p)))];
}

async function requireOwner() {
  const { role } = await getUserRole();
  return role === "owner";
}

export async function POST(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 40) return NextResponse.json({ error: "Name must be 1-40 characters" }, { status: 400 });

  const db = createAdminSupabase();
  const { data, error } = await db.from("roles")
    .insert({ name, permissions: cleanPermissions(body?.permissions) })
    .select("id, name, permissions, built_in").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, role: data });
}

export async function PUT(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = createAdminSupabase();
  const update: Record<string, unknown> = { permissions: cleanPermissions(body.permissions) };
  // Built-in role names are stable anchors (migration + docs refer to them)
  if (typeof body.name === "string" && body.name.trim()) {
    const { data: existing } = await db.from("roles").select("built_in").eq("id", body.id).single();
    if (!existing?.built_in) update.name = body.name.trim().slice(0, 40);
  }
  const { error } = await db.from("roles").update(update).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = createAdminSupabase();
  const { data: role } = await db.from("roles").select("built_in").eq("id", body.id).single();
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.built_in) return NextResponse.json({ error: "Built-in roles cannot be deleted" }, { status: 400 });

  const { count } = await db.from("project_access").select("id", { count: "exact", head: true }).eq("role_id", body.id);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: `Role is assigned to ${count} member(s) — reassign them first` }, { status: 400 });
  }
  const { error } = await db.from("roles").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
