import { fetchPerformanceData } from "./sheets";
import { computeMetrics } from "./metrics";
import { MONTH_NAMES, isPartialRange, formatWeekLabel, type Granularity } from "./dates";
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

// Legacy type — kept until trend-chart.tsx migrates (Task D3); deleted at Task E1
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

export function getWeekRanges(from: Date, to: Date, now: Date = new Date()): TrendRange[] {
  const ranges: TrendRange[] = [];
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekStart.getDate() + 6);
    ranges.push({
      from: weekStart,
      to: weekEnd,
      label: formatWeekLabel(weekStart, weekEnd),
      isPartial: isPartialRange(weekEnd, now),
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return ranges;
}

export function getMonthRanges(from: Date, to: Date, now: Date = new Date()): TrendRange[] {
  const ranges: TrendRange[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const endCursor = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor.getTime() <= endCursor.getTime()) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const label = `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
    ranges.push({
      from: monthStart,
      to: monthEnd,
      label,
      isPartial: isPartialRange(monthEnd, now),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ranges;
}

export async function fetchMonthlyTrends(
  sheetId: string,
  months: number = 6,
  brandName: string | null = null,
): Promise<MonthlyTrendPoint[]> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const ranges = getMonthRanges(from, to, now);
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
