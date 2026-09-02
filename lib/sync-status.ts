// ── Sync status for the diagnostics page (Phase 3, PRD §5) ──────
//
// Read-only service-role queries, called AFTER the page's view_diagnostics
// gate — same authorization model as lib/data-source.ts. The card answers
// "did the mirror sync, when, what changed, what was quarantined".

import { createAdminSupabase } from "./supabase/admin";

export interface SyncRunSummary {
  started_at: string;
  finished_at: string | null;
  status: string;
  trigger: string;
  /** wall seconds, one decimal; null while running / after a kill */
  seconds: number | null;
  changes: number | null;
  lead_rows: number | null;
  quarantined: number | null;
  error: string | null;
}

export interface SyncStatus {
  runs: SyncRunSummary[];
  quarantine: {
    total: number;
    latest: { tab_name: string; row_index: number | null; reason: string; created_at: string }[];
  };
  recentChanges: {
    metric_date: string;
    brand: string;
    metric: string;
    old_value: number | null;
    new_value: number | null;
    detected_at: string;
  }[];
}

/** Pure mapper from a sync_runs row — exported for tests. */
export function summarizeRun(r: {
  started_at: unknown; finished_at: unknown; status: unknown;
  trigger: unknown; stats: unknown; error: unknown;
}): SyncRunSummary {
  const stats = (r.stats ?? null) as { changes?: number; lead_rows?: number; quarantined?: number } | null;
  const started = String(r.started_at);
  const finished = r.finished_at ? String(r.finished_at) : null;
  return {
    started_at: started,
    finished_at: finished,
    status: String(r.status),
    trigger: String(r.trigger),
    seconds: finished
      ? Math.round((Date.parse(finished) - Date.parse(started)) / 100) / 10
      : null,
    changes: stats?.changes ?? null,
    lead_rows: stats?.lead_rows ?? null,
    quarantined: stats?.quarantined ?? null,
    error: r.error ? String(r.error) : null,
  };
}

export async function buildSyncStatus(clientId: string): Promise<SyncStatus> {
  const db = createAdminSupabase();
  const [runsRes, qCountRes, qLatestRes, changesRes] = await Promise.all([
    db.from("sync_runs")
      .select("started_at, finished_at, status, trigger, stats, error")
      .eq("client_id", clientId)
      .order("started_at", { ascending: false })
      .limit(5),
    db.from("quarantine_rows")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    db.from("quarantine_rows")
      .select("tab_name, row_index, reason, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(3),
    db.from("data_changes")
      .select("metric_date, brand, metric, old_value, new_value, detected_at")
      .eq("client_id", clientId)
      .order("detected_at", { ascending: false })
      .limit(10),
  ]);

  return {
    runs: (runsRes.data ?? []).map(summarizeRun),
    quarantine: {
      total: qCountRes.count ?? 0,
      latest: (qLatestRes.data ?? []).map((q) => ({
        tab_name: String(q.tab_name),
        row_index: q.row_index === null ? null : Number(q.row_index),
        reason: String(q.reason),
        created_at: String(q.created_at),
      })),
    },
    recentChanges: (changesRes.data ?? []).map((c) => ({
      metric_date: String(c.metric_date),
      brand: String(c.brand ?? ""),
      metric: String(c.metric),
      old_value: c.old_value === null ? null : Number(c.old_value),
      new_value: c.new_value === null ? null : Number(c.new_value),
      detected_at: String(c.detected_at),
    })),
  };
}
