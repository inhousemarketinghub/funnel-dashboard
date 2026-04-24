/** Date utilities for the funnel dashboard date range system */

export interface DateRangeObj {
  from: Date;
  to: Date;
}

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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

export function getDefaultRange(granularity?: Granularity, now: Date = new Date()): DateRangeObj {
  if (granularity === "weekly") {
    const thisSunday = getSundayOf(now);
    const fourWeeksAgoMonday = new Date(thisSunday);
    fourWeeksAgoMonday.setDate(thisSunday.getDate() - 27); // Sun - 27 days = Mon of week 4 back
    return { from: fourWeeksAgoMonday, to: thisSunday };
  }
  if (granularity === "monthly") {
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from, to };
  }
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

export type DatePreset = { label: string; value: string };

export const DATE_PRESETS: readonly DatePreset[] = [
  { label: "This Week", value: "this-week" },
  { label: "Last Week", value: "last-week" },
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
  { label: "Last 7 Days", value: "last-7" },
  { label: "Last 30 Days", value: "last-30" },
];

export const MONTHLY_PRESETS: readonly DatePreset[] = [
  { label: "Last 3 months", value: "last-3m" },
  { label: "Last 6 months", value: "last-6m" },
  { label: "Last 12 months", value: "last-12m" },
  { label: "YTD", value: "ytd" },
];

export const WEEKLY_PRESETS: readonly DatePreset[] = [
  { label: "Last 4 weeks", value: "last-4w" },
  { label: "Last 8 weeks", value: "last-8w" },
  { label: "Last 12 weeks", value: "last-12w" },
  { label: "Last 26 weeks", value: "last-26w" },
];

export function getPresetRange(preset: string, now: Date = new Date()): DateRangeObj {
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

    case "last-4w":
    case "last-8w":
    case "last-12w":
    case "last-26w": {
      const weeks =
        preset === "last-4w" ? 4 :
        preset === "last-8w" ? 8 :
        preset === "last-12w" ? 12 : 26;
      const thisSunday = getSundayOf(today);
      const from = new Date(thisSunday);
      from.setDate(thisSunday.getDate() - (weeks * 7 - 1));
      return { from, to: thisSunday };
    }

    case "last-3m":
    case "last-6m":
    case "last-12m": {
      const months = preset === "last-3m" ? 3 : preset === "last-6m" ? 6 : 12;
      const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from, to };
    }

    case "ytd": {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from, to };
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

export function isPartialRange(to: Date, now: Date = new Date()): boolean {
  return to.getTime() > now.getTime();
}

export function formatWeekLabel(from: Date, to: Date): string {
  const EN_DASH = "–"; // en dash (–)
  const fromMonth = MONTH_NAMES[from.getMonth()];
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${fromMonth} ${from.getDate()} ${EN_DASH} ${to.getDate()}`;
  }
  const toMonth = MONTH_NAMES[to.getMonth()];
  return `${fromMonth} ${from.getDate()} ${EN_DASH} ${toMonth} ${to.getDate()}`;
}
