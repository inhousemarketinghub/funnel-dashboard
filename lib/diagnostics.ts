// ── Diagnostics report assembly ────────────────────────────────
//
// Pure assembly layer for /[clientId]/diagnostics. Contains NO matching rules
// of its own — every tab/column decision is delegated to lib/sheets.ts so the
// report always describes exactly what the dashboard's parser did.

import {
  listSheetTabs, fetchSheetData, getDataFetchedAt,
  pickTab, pickPerformanceTab, TAB_RULES,
  diagnosePerfColumns, detectFunnelTypeFromColumns, parsePerformanceRows,
  deriveTracked, mergeTracked,
  type SheetTab, type TabRule, type PerfDiagnosis, type TrackedMetrics,
} from "./sheets";
import { scanSheet } from "./sheet-scanner";
import { computeMetrics } from "./metrics";
import type { DailyMetric, FunnelMetrics } from "./types";

export interface TabSectionDiagnosis {
  rule: TabRule;
  selected: string | null;
}

export interface DateCoverage {
  year: number;
  monthIdx: number; // 0-based
  presentDays: number[];
  missingDays: number[];
  lastCheckedDay: number; // coverage is only judged up to this day of month
}

export interface SanityIssue {
  code: "showup_exceeds_est" | "orders_exceed_showup" | "contact_exceeds_inquiry" | "sales_without_orders";
  values: Record<string, number>;
}

export interface BrandDiagnosis {
  brand: string | null; // null for single-brand sheets without @brand tabs
  tabName: string;
  hidden: boolean;
  diagnosis: PerfDiagnosis;
  funnelFromColumns: "appointment" | "walkin";
  funnelFromScanner: "appointment" | "walkin" | null; // null when scanner saw no such tab
  tracked: TrackedMetrics;
  coverage: DateCoverage;
  monthMetrics: FunnelMetrics;
  sanity: SanityIssue[];
}

export interface DiagnosticsReport {
  allTabs: SheetTab[];
  sources: { performance: TabSectionDiagnosis; lead: TabSectionDiagnosis; kpi: TabSectionDiagnosis };
  brandSections: BrandDiagnosis[];
  dbFunnelType: string | null;
  /** Any brand section whose header-inferred type disagrees with the DB row */
  funnelMismatch: boolean;
  overall: {
    brands: string[];
    perBrandTracked: Record<string, TrackedMetrics>;
    tracked: TrackedMetrics;
  } | null;
  fetchedAt: number | null;
}

/** Days with a Performance Tracker row vs days without, up to today (or month end). */
export function computeDateCoverage(
  data: DailyMetric[],
  year: number,
  monthIdx: number,
  today: Date,
): DateCoverage {
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIdx;
  const lastCheckedDay = isCurrentMonth ? Math.min(today.getDate(), daysInMonth) : daysInMonth;

  const present = new Set<number>();
  for (const row of data) {
    if (row.date.getFullYear() === year && row.date.getMonth() === monthIdx) {
      present.add(row.date.getDate());
    }
  }
  const presentDays: number[] = [];
  const missingDays: number[] = [];
  for (let d = 1; d <= lastCheckedDay; d++) {
    (present.has(d) ? presentDays : missingDays).push(d);
  }
  return { year, monthIdx, presentDays, missingDays, lastCheckedDay };
}

/**
 * Cheap plausibility checks on a month's aggregate. Checks involving an
 * untracked metric are skipped — an absent column is "not tracked", and
 * comparing against its silent 0 would manufacture false alarms.
 */
export function runSanityChecks(
  m: FunnelMetrics,
  tracked: TrackedMetrics,
  funnelType: "appointment" | "walkin",
): SanityIssue[] {
  const issues: SanityIssue[] = [];
  if (funnelType === "appointment") {
    if (tracked.showup && tracked.est_showup && m.showup > m.est_showup) {
      issues.push({ code: "showup_exceeds_est", values: { showup: m.showup, est_showup: m.est_showup } });
    }
    if (tracked.showup && m.orders > m.showup) {
      issues.push({ code: "orders_exceed_showup", values: { orders: m.orders, showup: m.showup } });
    }
  }
  if (m.contact > m.inquiry && m.inquiry > 0) {
    issues.push({ code: "contact_exceeds_inquiry", values: { contact: m.contact, inquiry: m.inquiry } });
  }
  if (m.sales > 0 && m.orders === 0) {
    issues.push({ code: "sales_without_orders", values: { sales: m.sales, orders: m.orders } });
  }
  return issues;
}

export async function buildDiagnosticsReport(
  sheetId: string,
  dbFunnelType: string | null,
  now: Date = new Date(),
): Promise<DiagnosticsReport> {
  const [allTabs, scan, fetchedAt] = await Promise.all([
    listSheetTabs(sheetId),
    scanSheet(sheetId).catch(() => null),
    getDataFetchedAt(sheetId),
  ]);

  const sources = {
    performance: { rule: TAB_RULES.performance, selected: pickPerformanceTab(allTabs) },
    lead: { rule: TAB_RULES.lead, selected: pickTab(allTabs, TAB_RULES.lead) },
    kpi: { rule: TAB_RULES.kpi, selected: pickTab(allTabs, TAB_RULES.kpi) },
  };

  // Same tab set fetchPerformanceData merges in multi-brand Overall mode.
  const perfTabs = allTabs.filter(
    (t) => t.name.toLowerCase().includes("performance tracker") && !t.name.toLowerCase().includes("filter"),
  );
  const scannerByTab = new Map((scan?.brands ?? []).map((b) => [b.perfTab, b.funnelType]));

  const brandSections: BrandDiagnosis[] = [];
  for (const tab of perfTabs) {
    const rows = await fetchSheetData(sheetId, tab.name);
    const diagnosis = diagnosePerfColumns(rows);
    const data = parsePerformanceRows(rows);
    const funnelFromColumns = detectFunnelTypeFromColumns(diagnosis.colMap);
    const tracked = deriveTracked(diagnosis.colMap);
    const monthData = data.filter(
      (r) => r.date.getFullYear() === now.getFullYear() && r.date.getMonth() === now.getMonth(),
    );
    const monthMetrics = computeMetrics(monthData, funnelFromColumns);
    brandSections.push({
      brand: tab.name.match(/@(.+)$/)?.[1] ?? null,
      tabName: tab.name,
      hidden: tab.hidden,
      diagnosis,
      funnelFromColumns,
      funnelFromScanner: scannerByTab.get(tab.name) ?? null,
      tracked,
      coverage: computeDateCoverage(data, now.getFullYear(), now.getMonth(), now),
      monthMetrics,
      sanity: runSanityChecks(monthMetrics, tracked, funnelFromColumns),
    });
  }

  const overall =
    brandSections.length > 1
      ? {
          brands: brandSections.map((b) => b.brand ?? b.tabName),
          perBrandTracked: Object.fromEntries(
            brandSections.map((b) => [b.brand ?? b.tabName, b.tracked]),
          ),
          tracked: brandSections
            .map((b) => b.tracked)
            .reduce(mergeTracked, { appointment: false, est_showup: false, showup: false }),
        }
      : null;

  return {
    allTabs,
    sources,
    brandSections,
    dbFunnelType,
    funnelMismatch:
      dbFunnelType !== null && brandSections.some((b) => b.funnelFromColumns !== dbFunnelType),
    overall,
    fetchedAt,
  };
}
