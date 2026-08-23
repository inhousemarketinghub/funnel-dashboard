import { NextRequest, NextResponse } from "next/server";
import { getUserRole, getProjectPermissions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { syncClient, syncAllClients } from "@/lib/sync";

// Sheet syncs can take a while across 8 clients × multiple tabs
export const maxDuration = 300;

// GET /api/sync — Vercel Cron entry. Requires CRON_SECRET to be configured;
// refuses to run unauthenticated rather than being a public quota-burner.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await syncAllClients("cron");
  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({ synced: results.length, failed }, { status: failed.length ? 500 : 200 });
}

// POST /api/sync { clientId } — manual trigger for signed-in admins
export async function POST(req: NextRequest) {
  const { role } = await getUserRole();
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await req.json().catch(() => ({}));
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const perms = await getProjectPermissions(clientId);
  if (!perms.includes("edit_settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("sheet_id").eq("id", clientId).single();
  if (!client?.sheet_id) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const result = await syncClient(clientId, client.sheet_id, "manual");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
