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

export async function fetchTrends(opts: {
  sheetId: string;
  granularity: Granularity;
  from: Date;
  to: Date;
  brandName?: string | null;
  now?: Date;
}): Promise<TrendPoint[]> {
  const now = opts.now ?? new Date();
  const ranges = opts.granularity === "weekly"
    ? getWeekRanges(opts.from, opts.to, now)
    : getMonthRanges(opts.from, opts.to, now);

  const results: TrendPoint[] = [];
  let allData: import("./types").DailyMetric[] = [];
  try {
    const perfResult = await fetchPerformanceData(opts.sheetId, opts.brandName ?? undefined);
    allData = perfResult.data;
  } catch (err) {
    console.error("fetchTrends: fetchPerformanceData failed", err);
    for (const range of ranges) {
      results.push({ label: range.label, isPartial: range.isPartial, metrics: zeroMetrics() });
    }
    return results;
  }

  for (const range of ranges) {
    try {
      const rows = allData.filter((r) => r.date >= range.from && r.date <= range.to);
      const metrics = computeMetrics(rows, 0);
      results.push({ label: range.label, isPartial: range.isPartial, metrics });
    } catch {
      results.push({ label: range.label, isPartial: range.isPartial, metrics: zeroMetrics() });
    }
  }
  return results;
}
