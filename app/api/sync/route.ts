import { NextRequest, NextResponse } from "next/server";
import { getUserRole, getProjectPermissions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { syncClient, listActiveClients, fanOutSync, markStaleRuns } from "@/lib/sync";

// A single sequential 8-client run outgrew the 60s Hobby ceiling (timed out two
// days running, 2026-08-25/26). The cron GET is now a dispatcher: it marks
// stale runs, then fires one worker invocation per client (GET ?clientId=…),
// each with its own 60s budget. Phase 2 still adds staleness-triggered
// per-client syncs so intra-day freshness doesn't depend on cron cadence.
export const maxDuration = 60;

// GET /api/sync — Vercel Cron entry (dispatcher) and per-client worker.
// Requires CRON_SECRET to be configured; refuses to run unauthenticated rather
// than being a public quota-burner.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (clientId) {
    // Worker mode: sync exactly one client inside this invocation's own budget.
    const db = createAdminSupabase();
    const { data: client } = await db.from("clients")
      .select("sheet_id").eq("id", clientId).eq("status", "active").single();
    if (!client?.sheet_id) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    const result = await syncClient(clientId, client.sheet_id, "cron");
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  // Dispatcher mode: janitor first, then one worker per active client.
  try {
    await markStaleRuns();
    const clients = await listActiveClients();
    const results = await fanOutSync(req.nextUrl.origin, clients, secret);
    const failed = results.filter((r) => !r.ok);
    return NextResponse.json({ synced: results.length, failed }, { status: failed.length ? 500 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
