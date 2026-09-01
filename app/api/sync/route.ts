import { NextRequest, NextResponse } from "next/server";
import { getUserRole, getProjectPermissions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { syncClient, listActiveClients, fanOutSync, markStaleRuns, recentSuccessWithin } from "@/lib/sync";

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
    // trigger=stale marks page-load staleness syncs apart from the daily cron
    // and is throttled — many stale renders must not stampede Google.
    const trigger = req.nextUrl.searchParams.get("trigger") === "stale" ? ("stale" as const) : ("cron" as const);
    if (trigger === "stale" && await recentSuccessWithin(clientId, 120)) {
      return NextResponse.json({ ok: true, skipped: "fresh" });
    }
    const db = createAdminSupabase();
    const { data: client } = await db.from("clients")
      .select("sheet_id").eq("id", clientId).eq("status", "active").single();
    if (!client?.sheet_id) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    const result = await syncClient(clientId, client.sheet_id, trigger);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  // Dispatcher mode: janitor first, then one worker per active client.
  try {
    await markStaleRuns();
    const clients = await listActiveClients();
    // Workers must be called through the PUBLIC production host. The request's
    // own origin resolves to the deployment-specific *.vercel.app URL, which
    // sits behind Vercel's deployment protection (302 → SSO login) — the
    // 2026-08-27 08:30 cron dispatched 8 workers that way and zero reached the
    // app. VERCEL_PROJECT_PRODUCTION_URL is the unprotected production alias;
    // req.nextUrl.origin remains the fallback for local dev.
    const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const base = prodHost ? `https://${prodHost}` : req.nextUrl.origin;
    const results = await fanOutSync(base, clients, secret);
    console.log(`sync dispatch via ${base}:`, JSON.stringify(results));
    const failed = results.filter((r) => !r.ok);
    return NextResponse.json({ synced: results.length, failed }, { status: failed.length ? 500 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/sync { clientId } — manual trigger for signed-in project members
// (the refresh button; throttled server-side)
export async function POST(req: NextRequest) {
  const { role } = await getUserRole();
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await req.json().catch(() => ({}));
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  // Any member with access to this project may refresh it — the button has
  // always been visible to every viewer (sheets mode never gated it either).
  const perms = await getProjectPermissions(clientId);
  if (perms.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Refresh throttle: a sync that just succeeded is fresh enough.
  if (await recentSuccessWithin(clientId, 120)) {
    return NextResponse.json({ ok: true, skipped: "fresh" });
  }

  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("sheet_id").eq("id", clientId).single();
  if (!client?.sheet_id) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const result = await syncClient(clientId, client.sheet_id, "manual");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
