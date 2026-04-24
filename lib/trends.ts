import { fetchPerformanceData } from "./sheets";
import { computeMetrics } from "./metrics";
import { MONTH_NAMES, isPartialRange, type Granularity } from "./dates";
import type { FunnelMetrics } from "./types";

export type { Granularity };

// Canonical trend types (used by fetchTrends, getWeekRanges, getMonthRanges new signature)
export interface TrendPoint {
  label: string;
  isPartial: boolean;
  metrics: FunnelMetrics;
}

export interface TrendRange {
  from: Date;
  to: Date;
  label: string;
  isPartial: boolean;
}

// Legacy types — kept until trend-chart.tsx migrates (Task D3); deleted at Task E1
export interface MonthRange {
  label: string;
  from: Date;
  to: Date;
}

export interface MonthlyTrendPoint {
  month: string;
  metrics: FunnelMetrics;
}

function zeroMetrics(): FunnelMetrics {
  return {
    ad_spend: 0, inquiry: 0, contact: 0, appointment: 0, showup: 0,
    est_showup: 0, orders: 0, sales: 0, cpl: 0, respond_rate: 0,
    appt_rate: 0, showup_rate: 0, conv_rate: 0, aov: 0, roas: 0, cpa_pct: 0,
  };
}

export function getMonthRanges(count: number, now: Date = new Date()): MonthRange[] {
  const ranges: MonthRange[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const label = `${MONTH_NAMES[month]} ${year}`;
    const from = new Date(year, month, 1);
    const to = i === 0 ? now : new Date(year, month + 1, 0);
    ranges.push({ label, from, to });
  }
  return ranges;
}

export async function fetchMonthlyTrends(
  sheetId: string,
  months: number = 6,
  brandName: string | null = null,
): Promise<MonthlyTrendPoint[]> {
  const ranges = getMonthRanges(months);
  const results: MonthlyTrendPoint[] = [];

  // Fetch all data once, then filter per range
  let allData: import("./types").DailyMetric[] = [];
  try {
    const perfResult = await fetchPerformanceData(sheetId, brandName ?? undefined);
    allData = perfResult.data;
  } catch {
    // Return zeros for all months if fetch fails
    for (const range of ranges) {
      results.push({ month: range.label, metrics: zeroMetrics() });
    }
    return results;
  }

  for (const range of ranges) {
    try {
      const rows = allData.filter((r) => r.date >= range.from && r.date <= range.to);
      const metrics = computeMetrics(rows, 0);
      results.push({ month: range.label, metrics });
    } catch {
      results.push({ month: range.label, metrics: zeroMetrics() });
    }
  }
  return results;
}
