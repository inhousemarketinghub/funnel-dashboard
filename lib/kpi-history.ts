import type { KpiTargetVersion, KPIConfig } from "./types";
import { createAdminSupabase } from "./supabase/admin";

const SNAPSHOT_KEYS: (keyof KPIConfig)[] = [
  "sales", "orders", "aov", "cpl", "respond_rate", "appt_rate", "showup_rate",
  "conv_rate", "ad_spend", "daily_ad", "roas", "cpa_pct",
  "target_contact", "target_appt", "target_showup",
];

function sortedDesc(versions: KpiTargetVersion[]): KpiTargetVersion[] {
  return [...versions].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
}

/** Latest version whose effective_from <= asOf (carry-forward). null if none. */
export function effectiveVersionAsOf(versions: KpiTargetVersion[], asOf: Date): KpiTargetVersion | null {
  const cut = asOf.getTime();
  return sortedDesc(versions).find((v) => new Date(v.effective_from).getTime() <= cut) ?? null;
}

/** Ascending: versions whose change landed inside (start, end]. The pre-period
 * baseline (for diffing the first in-range change) is fetched separately via
 * effectiveVersionAsOf(versions, start) by the caller, so it isn't shown as a
 * row dated before the period. */
export function versionsInRange(versions: KpiTargetVersion[], start: Date, end: Date): KpiTargetVersion[] {
  const s = start.getTime(), e = end.getTime();
  return versions
    .filter((v) => {
      const t = new Date(v.effective_from).getTime();
      return t > s && t <= e;
    })
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from));
}

/** Changed numeric fields between two snapshots. prev=null => initial set (from null). */
export function diffSnapshots(prev: KPIConfig | null, next: KPIConfig): { key: keyof KPIConfig; from: number | null; to: number }[] {
  const out: { key: keyof KPIConfig; from: number | null; to: number }[] = [];
  for (const key of SNAPSHOT_KEYS) {
    const to = Number(next[key] ?? 0);
    const from = prev ? Number(prev[key] ?? 0) : null;
    if (from === null ? to !== 0 : from !== to) out.push({ key, from, to });
  }
  return out;
}

/** UTC month-start Dates from earliest's month through now's month, inclusive, ascending. */
export function monthStartsBetween(earliest: Date, now: Date): Date[] {
  const out: Date[] = [];
  let y = earliest.getUTCFullYear(), m = earliest.getUTCMonth();
  const endY = now.getUTCFullYear(), endM = now.getUTCMonth();
  while (y < endY || (y === endY && m <= endM)) {
    out.push(new Date(Date.UTC(y, m, 1)));
    if (++m > 11) { m = 0; y++; }
  }
  return out;
}

// ── DB layer (service role) ──────────────────────────────────

/** Append one immutable target snapshot. Never updates existing rows. */
export async function appendTargetVersion(
  clientId: string, brand: string, snapshot: KPIConfig, changedBy: string | null,
): Promise<void> {
  const db = createAdminSupabase();
  const { error } = await db.from("kpi_target_versions").insert({
    client_id: clientId,
    brand: brand || "",
    effective_from: new Date().toISOString(),
    snapshot,
    source: "save",
    changed_by: changedBy,
  });
  if (error) throw new Error(`kpi_target_versions insert: ${error.message}`);
}

/** All versions for a client scoped to a brand (brand rows + the '' default). */
export async function fetchTargetVersions(clientId: string, brand: string): Promise<KpiTargetVersion[]> {
  const db = createAdminSupabase();
  const { data } = await db
    .from("kpi_target_versions")
    .select("id, client_id, brand, effective_from, snapshot, source, changed_by")
    .eq("client_id", clientId)
    .in("brand", brand ? [brand, ""] : [""])
    .order("effective_from", { ascending: false });
  return (data ?? []) as KpiTargetVersion[];
}

/** The target snapshot in effect as of `asOf` (carry-forward). null if none. */
export async function fetchEffectiveTarget(clientId: string, brand: string, asOf: Date): Promise<KPIConfig | null> {
  const versions = await fetchTargetVersions(clientId, brand);
  return effectiveVersionAsOf(versions, asOf)?.snapshot ?? null;
}
