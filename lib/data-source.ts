// ── Read-path adapter: live sheet vs Supabase mirror ────────────
//
// Phase 2 (C-tier PRD L84): profile.data_source branches HERE, at the read
// layer — both paths share the same UI components, computeMetrics, and the
// person-aggregation core (lib/sheets.ts buildPersonDataFromRows). This file
// contains NO parsing rules of its own: the sheet branch delegates to the
// lib/sheets.ts fetchers, the db branch reads what lib/sync.ts mirrored using
// those same rules.
//
// Authorization: DB reads use the service-role client AFTER the caller's
// session + permission gating — the same model as the sheet path (which
// Google-auths as the service account). The mirror tables' RLS SELECT policy
// stays in place as a belt, but is not relied upon here.

import { createAdminSupabase } from "./supabase/admin";
import {
  fetchPerformanceData, fetchPersonData, fetchLeadData, getDataFetchedAt,
  detectBrandsOrdered, buildPersonDataFromRows, mergeTracked,
  fetchKPIData, fetchOverallKPI, combineKPI,
  type PerfResult, type PersonData, type SyncLeadRow, type TrackedMetrics,
  type KPIMirrorEntry,
} from "./sheets";
import { parseDateParam } from "./dates";
import { parseProfile, dataSourceOf } from "./profile";
import type { DailyMetric, Lead, KPIConfig } from "./types";

export interface DataClient { id: string; sheet_id: string; profile?: unknown }
export type DataSourceMode = "sheets" | "db";

/** Resolve the effective data source for one render. `override` comes from
 *  the admin-only ?ds= test switch — callers MUST permission-check it before
 *  passing it in (edit_settings). Render-scoped; never persisted. */
export function resolveDataSource(client: DataClient, override?: string | null): DataSourceMode {
  if (override === "db" || override === "sheets") return override;
  return dataSourceOf(parseProfile(client.profile));
}

const METRIC_FIELDS = [
  "ad_spend", "lead_funnel_spend", "branding_spend", "inquiry", "contact",
  "appointment", "est_showup", "showup", "orders", "sales",
] as const;

const PAGE = 1000;

/** PostgREST caps a single select at 1000 rows — page through everything.
 *  The query MUST carry a stable .order() for the ranges to be consistent. */
async function readAll<Row>(
  build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  what: string,
): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(`${what} read: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function toDailyMetric(r: Record<string, unknown>): DailyMetric {
  return {
    date: parseDateParam(String(r.date))!,
    ad_spend: Number(r.ad_spend), lead_funnel_spend: Number(r.lead_funnel_spend),
    branding_spend: Number(r.branding_spend), inquiry: Number(r.inquiry),
    contact: Number(r.contact), appointment: Number(r.appointment),
    est_showup: Number(r.est_showup), showup: Number(r.showup),
    orders: Number(r.orders), sales: Number(r.sales),
  };
}

export async function getPerformanceData(
  client: DataClient, mode: DataSourceMode, brandName?: string,
): Promise<PerfResult> {
  if (mode === "sheets") return fetchPerformanceData(client.sheet_id, brandName);
  const db = createAdminSupabase();

  const rows = await readAll<Record<string, unknown>>((from, to) => {
    let q = db.from("daily_metrics")
      .select("brand, date, ad_spend, lead_funnel_spend, branding_spend, inquiry, contact, appointment, est_showup, showup, orders, sales")
      .eq("client_id", client.id);
    if (brandName !== undefined) q = q.eq("brand", brandName);
    return q.order("date").order("brand").range(from, to);
  }, "daily_metrics");

  const { data: states, error: stErr } = await db.from("brand_states")
    .select("brand, tab_name, funnel_type, tracked")
    .eq("client_id", client.id);
  if (stErr) throw new Error(`brand_states read: ${stErr.message}`);
  const relevant = (states ?? [])
    .filter((s) => brandName === undefined || s.brand === brandName)
    .sort((a, b) => String(a.tab_name).localeCompare(String(b.tab_name)));

  // funnelType mirrors the sheet path: a single tab uses its own header
  // detection (brand_states stores exactly that); the multi-brand merge lets
  // the LAST tab win. Sheet tab order isn't mirrored, so tab_name order
  // stands in — every real multi-brand client is single-funnel anyway, and
  // the reconciliation gate would surface a divergence.
  const funnelType = (relevant.length
    ? relevant[relevant.length - 1].funnel_type
    : "appointment") as PerfResult["funnelType"];
  const tracked: TrackedMetrics = relevant.length
    ? relevant
        .map((s) => (s.tracked ?? { appointment: false, est_showup: false, showup: false }) as TrackedMetrics)
        .reduce((a, b) => mergeTracked(a, b))
    : { appointment: true, est_showup: true, showup: true };

  const distinctBrands = new Set(rows.map((r) => String(r.brand)));
  let data: DailyMetric[];
  if (brandName === undefined && distinctBrands.size > 1) {
    // Multi-brand Overall: sum metrics for the same date across brands
    // (same semantics as the sheet path's merge).
    const byDate = new Map<string, DailyMetric>();
    for (const r of rows) {
      const key = String(r.date);
      const m = toDailyMetric(r);
      const existing = byDate.get(key);
      if (existing) {
        for (const f of METRIC_FIELDS) existing[f] = existing[f] + m[f];
      } else {
        byDate.set(key, m);
      }
    }
    data = Array.from(byDate.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  } else {
    data = rows.map(toDailyMetric);
  }

  return { data, funnelType, tracked };
}

async function readLeadModel(clientId: string): Promise<SyncLeadRow[]> {
  const db = createAdminSupabase();
  const raw = await readAll<Record<string, unknown>>((from, to) =>
    db.from("lead_rows")
      .select("brand, lead_date, source, appointment_person, sales_person, appointment_date, appointment_marked, showed_up, purchase_date, purchase_marked, sales")
      .eq("client_id", clientId)
      .order("row_no", { ascending: true, nullsFirst: false })
      .order("id")
      .range(from, to), "lead_rows");
  return raw.map((r) => ({
    brand: String(r.brand ?? ""),
    lead_date: r.lead_date ? parseDateParam(String(r.lead_date)) : null,
    source: String(r.source ?? ""),
    appointment_person: String(r.appointment_person ?? ""),
    sales_person: String(r.sales_person ?? ""),
    appointment_date: r.appointment_date ? parseDateParam(String(r.appointment_date)) : null,
    appointment_marked: Boolean(r.appointment_marked),
    showed_up: Boolean(r.showed_up),
    purchase_date: r.purchase_date ? parseDateParam(String(r.purchase_date)) : null,
    purchase_marked: Boolean(r.purchase_marked),
    sales: Number(r.sales),
  }));
}

export async function getPersonData(
  client: DataClient, mode: DataSourceMode,
  startDate?: Date, endDate?: Date, brandName?: string, sources?: string[],
): Promise<PersonData> {
  if (mode === "sheets") return fetchPersonData(client.sheet_id, startDate, endDate, brandName, sources);
  const db = createAdminSupabase();
  const [model, stateRes] = await Promise.all([
    readLeadModel(client.id),
    db.from("client_states").select("lead_appointment_col").eq("client_id", client.id).maybeSingle(),
  ]);
  return buildPersonDataFromRows(model, {
    isWalkinFunnel: stateRes.data ? !stateRes.data.lead_appointment_col : false,
    startDate, endDate, brandName, sources,
  });
}

export async function getLeadData(
  client: DataClient, mode: DataSourceMode, brandName?: string,
): Promise<Lead[]> {
  if (mode === "sheets") return fetchLeadData(client.sheet_id, brandName);
  let model = await readLeadModel(client.id);
  if (brandName) {
    model = model.filter((r) => r.brand.toLowerCase() === brandName.toLowerCase());
  }
  return model.map((r) => ({
    appointment_date: r.appointment_date,
    showed_up: r.showed_up,
    sales: r.sales,
    purchase_date: r.purchase_date,
  }));
}

/** Epoch ms of "how fresh is what this page shows". Sheets: when the cached
 *  Google response was pulled. DB: when the last successful sync finished. */
export async function getFreshness(client: DataClient, mode: DataSourceMode): Promise<number | null> {
  if (mode === "sheets") return getDataFetchedAt(client.sheet_id);
  const db = createAdminSupabase();
  const { data } = await db.from("sync_runs")
    .select("finished_at")
    .eq("client_id", client.id).eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1).maybeSingle();
  return data?.finished_at ? Date.parse(String(data.finished_at)) : null;
}

/** Ordered kpi_mirror entries for a client (empty = not mirrored yet). */
export async function readKPIMirror(clientId: string): Promise<KPIMirrorEntry[]> {
  const db = createAdminSupabase();
  const { data, error } = await db.from("kpi_mirror")
    .select("brand, kpi, derived, position")
    .eq("client_id", clientId)
    .order("position");
  if (error) throw new Error(`kpi_mirror read: ${error.message}`);
  return (data ?? []).map((r) => ({
    brand: String(r.brand ?? ""),
    kpi: r.kpi as KPIMirrorEntry["kpi"],
    derived: r.derived as KPIMirrorEntry["derived"],
    position: Number(r.position),
  }));
}

/** Match one mirror entry the way the sheet parser would resolve a brand ask:
 *  exact brand match; no-brand ask prefers the single-brand "" entry; a lone
 *  section serves any ask (parseKPIRows' default-offset behavior). */
export function pickKPIMirrorEntry(entries: KPIMirrorEntry[], brandName?: string): KPIMirrorEntry | undefined {
  return (brandName !== undefined
    ? entries.find((e) => e.brand.toLowerCase() === brandName.toLowerCase())
    : entries.find((e) => e.brand === "")) ?? (entries.length === 1 ? entries[0] : undefined);
}

export async function getKPIData(
  client: DataClient, mode: DataSourceMode, brandName?: string,
): Promise<KPIConfig | null> {
  if (mode === "sheets") return fetchKPIData(client.sheet_id, brandName);
  const entries = await readKPIMirror(client.id);
  if (entries.length === 0) return fetchKPIData(client.sheet_id, brandName); // pre-first-sync fallback
  return pickKPIMirrorEntry(entries, brandName)?.kpi ?? null;
}

export async function getOverallKPI(
  client: DataClient, mode: DataSourceMode, brands: string[],
): Promise<KPIConfig> {
  if (mode === "sheets") return fetchOverallKPI(client.sheet_id, brands);
  const entries = await readKPIMirror(client.id);
  if (entries.length === 0) return fetchOverallKPI(client.sheet_id, brands);
  const wanted = new Set(brands.map((b) => b.toLowerCase()));
  return combineKPI(entries.filter((e) => wanted.has(e.brand.toLowerCase())).map((e) => e.kpi));
}

/** Brand list. Sheets: KPI-tab section order. DB: kpi_mirror position order
 *  (same source as the sheet path), falling back to brand_states for clients
 *  whose mirror hasn't filled yet. */
export async function getBrands(client: DataClient, mode: DataSourceMode): Promise<string[]> {
  if (mode === "sheets") return detectBrandsOrdered(client.sheet_id);
  const named = (await readKPIMirror(client.id)).filter((e) => e.brand !== "").map((e) => e.brand);
  if (named.length > 0) return named;
  const db = createAdminSupabase();
  const { data, error } = await db.from("brand_states")
    .select("brand, tab_name")
    .eq("client_id", client.id)
    .order("tab_name");
  if (error) throw new Error(`brand_states read: ${error.message}`);
  return (data ?? []).map((s) => String(s.brand)).filter((b) => b !== "");
}
