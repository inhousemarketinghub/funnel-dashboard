/** Date utilities for the funnel dashboard date range system */

export interface DateRangeObj {
  from: Date;
  to: Date;
}

// ── Parsing & Formatting ────────────────────────────────────────

export function parseDateParam(str: string | undefined): Date | null {
  if (!str) return null;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export function formatRangeLabel(from: Date, to: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear();
  const sameMonth = sameYear && from.getMonth() === to.getMonth();
  const sameDay = sameMonth && from.getDate() === to.getDate();

  if (sameDay) return formatDateDisplay(from);

  const fromStr = sameYear
    ? from.toLocaleDateString("en", { month: "short", day: "numeric" })
    : formatDateDisplay(from);
  const toStr = formatDateDisplay(to);
  return `${fromStr} \u2013 ${toStr}`;
}

// ── Defaults & Previous Period ──────────────────────────────────

export function getDefaultRange(): DateRangeObj {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: now,
  };
}

export function getPreviousPeriod(from: Date, to: Date): DateRangeObj {
  const daysDiff = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo = new Date(from.getTime() - 86400000); // day before `from`
  const prevFrom = new Date(prevTo.getTime() - (daysDiff - 1) * 86400000);
  return { from: prevFrom, to: prevTo };
}

export function resolveSearchParams(
  fromStr: string | string[] | undefined,
  toStr: string | string[] | undefined,
): DateRangeObj {
  const f = parseDateParam(Array.isArray(fromStr) ? fromStr[0] : fromStr);
  const t = parseDateParam(Array.isArray(toStr) ? toStr[0] : toStr);
  if (f && t && f <= t) return { from: f, to: t };
  return getDefaultRange();
}

// ── Presets ──────────────────────────────────────────────────────

export const DATE_PRESETS = [
  { label: "This Week", value: "this-week" },
  { label: "Last Week", value: "last-week" },
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
  { label: "Last 7 Days", value: "last-7" },
  { label: "Last 30 Days", value: "last-30" },
] as const;

export function getPresetRange(preset: string): DateRangeObj {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "this-week": {
      const day = today.getDay(); // 0=Sun
      const monday = new Date(today);
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      return { from: monday, to: today };
    }
    case "last-week": {
      const day = today.getDay();
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return { from: lastMonday, to: lastSunday };
    }
    case "this-month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: today };
    case "last-month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
      return { from, to };
    }
    case "last-7": {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);
      return { from, to: today };
    }
    case "last-30": {
      const from = new Date(today);
      from.setDate(today.getDate() - 29);
      return { from, to: today };
    }
    default:
      return getDefaultRange();
  }
}

// ── Week boundary helpers ────────────────────────────────────────

export function getMondayOf(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  result.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

export function getSundayOf(d: Date): Date {
  const day = d.getDay();
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  result.setDate(d.getDate() + (day === 0 ? 0 : 7 - day));
  return result;
}

// ── Granularity & snapping ───────────────────────────────────────

export type Granularity = "weekly" | "monthly";

export function snapToGranularity(
  range: DateRangeObj,
  granularity: Granularity,
): DateRangeObj {
  if (granularity === "weekly") {
    return {
      from: getMondayOf(range.from),
      to: getSundayOf(range.to),
    };
  }
  return {
    from: new Date(range.from.getFullYear(), range.from.getMonth(), 1),
    to: new Date(range.to.getFullYear(), range.to.getMonth() + 1, 0),
  };
}
