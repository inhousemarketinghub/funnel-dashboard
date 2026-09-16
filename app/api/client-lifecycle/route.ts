import { NextRequest, NextResponse } from "next/server";
import { getUserRole } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

// Project lifecycle: archive (reversible, hides + stops syncing) and permanent
// delete (cascades away all client data). Owner-only — these are destructive
// and out of scope for managers. Service-role write (clients DELETE/UPDATE RLS
// is owner-scoped; this route enforces owner itself).

async function requireOwner() {
  const { role } = await getUserRole();
  return role === "owner";
}

// PATCH { clientId, status } — flip status (active | inactive | archived)
export async function PATCH(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const clientId = body?.clientId;
  const status = body?.status;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  if (!["active", "inactive", "archived"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const db = createAdminSupabase();
  const { error } = await db.from("clients").update({ status }).eq("id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}

// DELETE { clientId, confirmName } — permanent, cascades. confirmName must
// exactly match the project name (typed confirmation, guards against misclicks).
export async function DELETE(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const clientId = body?.clientId;
  const confirmName = typeof body?.confirmName === "string" ? body.confirmName.trim() : "";
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const db = createAdminSupabase();
  const { data: client } = await db.from("clients").select("name, status").eq("id", clientId).single();
  if (!client) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Only archived projects can be permanently deleted — forces the reversible
  // step first, so a live project can never be nuked in one action.
  if (client.status !== "archived") {
    return NextResponse.json({ error: "Archive the project before deleting it permanently" }, { status: 400 });
  }
  if (confirmName !== client.name) {
    return NextResponse.json({ error: "Typed name does not match the project name" }, { status: 400 });
  }

  // activity_log FK is NO ACTION — clear its rows first so the cascade doesn't
  // get blocked (every other child table cascades automatically).
  await db.from("activity_log").delete().eq("client_id", clientId);
  const { error } = await db.from("clients").delete().eq("id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
