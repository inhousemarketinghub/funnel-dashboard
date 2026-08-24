// ── Sync engine: Google Sheets → Supabase mirror ───────────────
//
// C-tier Phase 1 (PRD docs/prd/2026-08-23-c-tier-data-foundation.md).
// The sheet stays the entry surface; this engine mirrors it into Supabase with
// validation. Parsing is delegated entirely to lib/sheets.ts — one rule set.
//
// Semantics:
// - daily_metrics: keyed upsert per (client, brand, date); value differences
//   vs the previous mirror are recorded in data_changes (改要留痕); dates that
//   vanish from the sheet are deleted and logged with new_value = null.
// - lead_rows: wholesale replace (sheet rows have no stable identity), skipped
//   entirely when the tab's content hash is unchanged (23k-row tabs shouldn't
//   be rewritten every 15 minutes for nothing).
// - Rows the validator refuses land in quarantine_rows, never in the mirror.

import { createHash } from "crypto";
import { createAdminSupabase } from "./supabase/admin";
import {
  listSheetTabs, fetchSheetData, pickTab, TAB_RULES,
  diagnosePerfColumns, detectFunnelTypeFromColumns, parsePerformanceRows,
  deriveTracked, extractLeadRows,
} from "./sheets";
import { formatDateParam } from "./dates";
import type { DailyMetric } from "./types";

const METRIC_FIELDS = [
  "ad_spend", "lead_funnel_spend", "branding_spend", "inquiry", "contact",
  "appointment", "est_showup", "showup", "orders", "sales",
] as const;
type MetricField = (typeof METRIC_FIELDS)[number];

export interface DailyDiff {
  upserts: Record<string, unknown>[];
  deletes: { brand: string; date: string }[];
  changes: { brand: string; metric_date: string; metric: string; old_value: number | null; new_value: number | null }[];
}

/**
 * Pure diff between the previous mirror and freshly parsed sheet rows.
 * Exported for tests. `existing` and `incoming` are keyed by `${brand}|${date}`.
 */
export function diffDailyMetrics(
  existing: Map<string, Record<MetricField, number>>,
  incoming: Map<string, Record<MetricField, number>>,
): DailyDiff {
  const upserts: DailyDiff["upserts"] = [];
  const deletes: DailyDiff["deletes"] = [];
  const changes: DailyDiff["changes"] = [];

  for (const [key, row] of incoming) {
    const [brand, date] = splitKey(key);
    const prev = existing.get(key);
    if (!prev) {
      upserts.push({ brand, date, ...row });
      continue; // first sighting is not a "change" — no audit noise on backfill
    }
    let dirty = false;
    for (const f of METRIC_FIELDS) {
      if (Number(prev[f]) !== Number(row[f])) {
        dirty = true;
        changes.push({ brand, metric_date: date, metric: f, old_value: Number(prev[f]), new_value: Number(row[f]) });
      }
    }
    if (dirty) upserts.push({ brand, date, ...row });
  }

  for (const key of existing.keys()) {
    if (!incoming.has(key)) {
      const [brand, date] = splitKey(key);
      deletes.push({ brand, date });
      for (const f of METRIC_FIELDS) {
        const v = Number(existing.get(key)![f]);
        if (v !== 0) changes.push({ brand, metric_date: date, metric: f, old_value: v, new_value: null });
      }
    }
  }
  return { upserts, deletes, changes };
}

const keyOf = (brand: string, date: string) => `${brand}|${date}`;
const splitKey = (k: string): [string, string] => {
  const i = k.indexOf("|");
  return [k.slice(0, i), k.slice(i + 1)];
};

function toMetricRecord(r: DailyMetric): Record<MetricField, number> {
  return {
    ad_spend: r.ad_spend, lead_funnel_spend: r.lead_funnel_spend, branding_spend: r.branding_spend,
    inquiry: r.inquiry, contact: r.contact, appointment: r.appointment,
    est_showup: r.est_showup, showup: r.showup, orders: r.orders, sales: r.sales,
  };
}

export interface SyncStats {
  perf_tabs: number;
  daily_upserts: number;
  daily_deletes: number;
  changes: number;
  lead_rows: number;
  lead_skipped_unchanged: boolean;
  quarantined: number;
}

export async function syncClient(
  clientId: string,
  sheetId: string,
  trigger: "cron" | "manual" | "stale",
): Promise<{ ok: boolean; stats?: SyncStats; error?: string }> {
  const db = createAdminSupabase();
  const { data: run } = await db.from("sync_runs")
    .insert({ client_id: clientId, trigger })
    .select("id").single();
  const runId = run?.id;

  try {
    const tabs = await listSheetTabs(sheetId);
    const perfTabs = tabs.filter(
      (t) => t.name.toLowerCase().includes("performance tracker") && !t.name.toLowerCase().includes("filter"),
    );
    const stats: SyncStats = {
      perf_tabs: perfTabs.length, daily_upserts: 0, daily_deletes: 0,
      changes: 0, lead_rows: 0, lead_skipped_unchanged: false, quarantined: 0,
    };

    // Previous mirror for diffing. Paginated: PostgREST caps a single select at
    // 1000 rows — an unpaginated read silently truncated big clients' mirrors,
    // making the tail look "new" every run and (worse) skipping change-audit
    // for it, since first sightings are deliberately not logged.
    const existingRows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: pg, error } = await db.from("daily_metrics")
        .select("brand, date, ad_spend, lead_funnel_spend, branding_spend, inquiry, contact, appointment, est_showup, showup, orders, sales")
        .eq("client_id", clientId)
        .range(from, from + 999);
      if (error) throw new Error(`daily_metrics read: ${error.message}`);
      existingRows.push(...(pg ?? []));
      if (!pg || pg.length < 1000) break;
    }
    const existing = new Map<string, Record<MetricField, number>>();
    for (const r of existingRows ?? []) {
      const { brand, date, ...metrics } = r as { brand: string; date: string } & Record<MetricField, number>;
      existing.set(keyOf(brand, date), metrics);
    }

    // Fresh parse of every performance tab
    const incoming = new Map<string, Record<MetricField, number>>();
    for (const tab of perfTabs) {
      const brand = tab.name.match(/@(.+)$/)?.[1] ?? "";
      const rows = await fetchSheetData(sheetId, tab.name, { fresh: true });
      const diagnosis = diagnosePerfColumns(rows);
      for (const r of parsePerformanceRows(rows)) {
        incoming.set(keyOf(brand, formatDateParam(r.date)), toMetricRecord(r));
      }
      await db.from("brand_states").upsert({
        client_id: clientId, brand, tab_name: tab.name,
        funnel_type: detectFunnelTypeFromColumns(diagnosis.colMap),
        tracked: deriveTracked(diagnosis.colMap),
        columns: diagnosis.columns,
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_id,brand" });
    }

    const diff = diffDailyMetrics(existing, incoming);
    for (const chunk of chunks(diff.upserts, 500)) {
      const { error } = await db.from("daily_metrics").upsert(
        chunk.map((u) => ({ ...u, client_id: clientId, synced_at: new Date().toISOString() })),
        { onConflict: "client_id,brand,date" },
      );
      if (error) throw new Error(`daily_metrics upsert: ${error.message}`);
    }
    for (const d of diff.deletes) {
      await db.from("daily_metrics").delete()
        .eq("client_id", clientId).eq("brand", d.brand).eq("date", d.date);
    }
    if (diff.changes.length > 0) {
      await db.from("data_changes").insert(
        diff.changes.map((c) => ({ ...c, client_id: clientId, sync_run_id: runId })),
      );
    }
    stats.daily_upserts = diff.upserts.length;
    stats.daily_deletes = diff.deletes.length;
    stats.changes = diff.changes.length;

    // Lead tab mirror — skip wholesale replace when content is unchanged
    const leadTab = pickTab(tabs, TAB_RULES.lead);
    if (leadTab) {
      const rows = await fetchSheetData(sheetId, leadTab, { fresh: true });
      const hash = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
      const { data: state } = await db.from("client_states")
        .select("lead_hash").eq("client_id", clientId).maybeSingle();
      if (state?.lead_hash === hash) {
        stats.lead_skipped_unchanged = true;
      } else {
        const extraction = extractLeadRows(rows);
        await db.from("lead_rows").delete().eq("client_id", clientId);
        for (const chunk of chunks(extraction.rows, 500)) {
          const { error } = await db.from("lead_rows").insert(chunk.map((r) => ({
            client_id: clientId,
            brand: r.brand,
            lead_date: r.lead_date ? formatDateParam(r.lead_date) : null,
            source: r.source,
            appointment_person: r.appointment_person,
            sales_person: r.sales_person,
            appointment_date: r.appointment_date ? formatDateParam(r.appointment_date) : null,
            showed_up: r.showed_up,
            purchase_date: r.purchase_date ? formatDateParam(r.purchase_date) : null,
            sales: r.sales,
          })));
          if (error) throw new Error(`lead_rows insert: ${error.message}`);
        }
        if (extraction.quarantined.length > 0) {
          await db.from("quarantine_rows").insert(extraction.quarantined.map((q) => ({
            client_id: clientId, tab_name: leadTab, row_index: q.rowIndex,
            reason: q.reason, sample: q.sample, sync_run_id: runId,
          })));
        }
        await db.from("client_states").upsert(
          { client_id: clientId, lead_hash: hash, updated_at: new Date().toISOString() },
          { onConflict: "client_id" },
        );
        stats.lead_rows = extraction.rows.length;
        stats.quarantined = extraction.quarantined.length;
      }
    }

    await db.from("sync_runs").update({
      status: "success", finished_at: new Date().toISOString(), stats,
    }).eq("id", runId);
    return { ok: true, stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("sync_runs").update({
      status: "error", finished_at: new Date().toISOString(), error: message,
    }).eq("id", runId);
    return { ok: false, error: message };
  }
}

export async function syncAllClients(trigger: "cron" | "manual" | "stale") {
  const db = createAdminSupabase();
  const { data: clients } = await db.from("clients")
    .select("id, name, sheet_id").eq("status", "active");
  const results: { client: string; ok: boolean; error?: string }[] = [];
  for (const c of clients ?? []) {
    const r = await syncClient(c.id, c.sheet_id, trigger);
    results.push({ client: c.name, ok: r.ok, error: r.error });
  }
  return results;
}

function* chunks<T>(arr: T[], size: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}
