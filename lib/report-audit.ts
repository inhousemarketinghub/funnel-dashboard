// ── Report snapshots + "data changed since report" (Phase 3, PRD §3) ──
//
// 审计留痕 L68: 月报生成时快照当月合计；之后该月数据变动 → dashboard 该月
// 显示「⚠ 本月数据在报告生成后有更新」角标，点开见变更清单。
// 会计类比：划线更正 + 签名，不用涂改液。
//
// Service-role writes/reads (report_snapshots has read-only RLS); callers sit
// behind the pages' existing session gates.

import { createAdminSupabase } from "./supabase/admin";
import type { FunnelMetrics } from "./types";

export interface ChangeItem {
  metric_date: string;
  brand: string;
  metric: string;
  old_value: number | null;
  new_value: number | null;
  detected_at: string;
}

/** First/last day of a month as Y-M-D strings. Pure — exported for tests. */
export function monthRange(year: number, month1: number): { start: string; end: string } {
  const mm = String(month1).padStart(2, "0");
  const last = new Date(year, month1, 0).getDate();
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

/**
 * Upsert the month's snapshot at 月报生成时. Re-generating the report
 * refreshes the timestamp, so the badge always means "changed since the
 * report was LAST generated". Never throws — a snapshot failure must not
 * break the report render.
 */
export async function writeReportSnapshot(
  clientId: string, year: number, month1: number,
  payload: { metrics: FunnelMetrics; dataSource: string },
): Promise<void> {
  const db = createAdminSupabase();
  const now = new Date().toISOString();
  const { error } = await db.from("report_snapshots").upsert({
    client_id: clientId,
    month: monthRange(year, month1).start,
    snapshot: { ...payload, generated_at: now },
    created_at: now,
  }, { onConflict: "client_id,month" });
  if (error) console.error("report_snapshots upsert:", error.message);
}

/**
 * Changes touching month M detected AFTER that month's snapshot. Empty when
 * no snapshot exists — no report has been generated, so there is nothing to
 * contradict yet.
 */
export async function changesSinceSnapshot(
  clientId: string, year: number, month1: number, limit = 50,
): Promise<ChangeItem[]> {
  const db = createAdminSupabase();
  const { start, end } = monthRange(year, month1);
  const { data: snap } = await db.from("report_snapshots")
    .select("created_at")
    .eq("client_id", clientId).eq("month", start)
    .maybeSingle();
  if (!snap?.created_at) return [];
  const { data } = await db.from("data_changes")
    .select("metric_date, brand, metric, old_value, new_value, detected_at")
    .eq("client_id", clientId)
    .gte("metric_date", start).lte("metric_date", end)
    .gt("detected_at", String(snap.created_at))
    .order("detected_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((c) => ({
    metric_date: String(c.metric_date),
    brand: String(c.brand ?? ""),
    metric: String(c.metric),
    old_value: c.old_value === null ? null : Number(c.old_value),
    new_value: c.new_value === null ? null : Number(c.new_value),
    detected_at: String(c.detected_at),
  }));
}
