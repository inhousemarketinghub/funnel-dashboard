"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  DATE_PRESETS,
  getPresetRange,
  formatDateParam,
  formatRangeLabel,
  parseDateParam,
  getDefaultRange,
  getPreviousPeriod,
  type DatePreset,
} from "@/lib/dates";
import { t, type Lang } from "@/lib/i18n";
import type { DateRange } from "react-day-picker";

// Chinese labels for the date presets (English falls back to the preset's own label).
const PRESET_ZH: Record<string, string> = {
  "this-week": "本周", "last-week": "上周", "this-month": "本月", "last-month": "上月",
  "last-7": "近 7 天", "last-30": "近 30 天",
  "last-3m": "近 3 个月", "last-6m": "近 6 个月", "last-12m": "近 12 个月", "ytd": "年初至今",
  "last-4w": "近 4 周", "last-8w": "近 8 周", "last-12w": "近 12 周", "last-26w": "近 26 周",
};

interface Props {
  clientId: string;
  basePath?: string;
  presets?: readonly DatePreset[];
  maxRange?: { weeks?: number; months?: number };
  extraParams?: Record<string, string>;
  lang?: Lang;
}

export function DateRangePicker({ clientId, basePath, presets, maxRange, extraParams, lang = "en" }: Props) {
  const presetLabel = (p: DatePreset) => (lang === "zh" && PRESET_ZH[p.value]) || p.label;
  const effectiveBasePath = basePath ?? `/${clientId}`;
  const effectivePresets = presets ?? DATE_PRESETS;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"current" | "compare">("current");

  // Read current range from URL
  const fromParam = parseDateParam(searchParams.get("from") ?? undefined);
  const toParam = parseDateParam(searchParams.get("to") ?? undefined);
  const current = fromParam && toParam && fromParam <= toParam
    ? { from: fromParam, to: toParam }
    : getDefaultRange();

  // Read previous period from URL (or auto-calculate)
  const prevFromParam = parseDateParam(searchParams.get("prevFrom") ?? undefined);
  const prevToParam = parseDateParam(searchParams.get("prevTo") ?? undefined);
  const autoCompare = getPreviousPeriod(current.from, current.to);
  const prev = prevFromParam && prevToParam && prevFromParam <= prevToParam
    ? { from: prevFromParam, to: prevToParam }
    : autoCompare;

  // Calendar states
  const [calRange, setCalRange] = useState<DateRange | undefined>({
    from: current.from,
    to: current.to,
  });
  const [compareRange, setCompareRange] = useState<DateRange | undefined>({
    from: prev.from,
    to: prev.to,
  });

  function navigate(from: Date, to: Date, prevFrom?: Date, prevTo?: Date) {
    const params = new URLSearchParams();
    params.set("from", formatDateParam(from));
    params.set("to", formatDateParam(to));
    if (prevFrom && prevTo) {
      params.set("prevFrom", formatDateParam(prevFrom));
      params.set("prevTo", formatDateParam(prevTo));
    }
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v) params.set(k, v);
      }
    }
    startTransition(() => {
      router.replace(`${effectiveBasePath}?${params.toString()}`);
    });
    setOpen(false);
  }

  function checkOverLimit(from?: Date, to?: Date): boolean {
    if (!from || !to) return false;
    if (maxRange?.weeks) {
      const weeks = Math.ceil((to.getTime() - from.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weeks > maxRange.weeks) return true;
    }
    if (maxRange?.months) {
      const months =
        (to.getFullYear() - from.getFullYear()) * 12 +
        (to.getMonth() - from.getMonth()) + 1;
      if (months > maxRange.months) return true;
    }
    return false;
  }

  function handlePreset(preset: string) {
    const range = getPresetRange(preset);
    setCalRange({ from: range.from, to: range.to });
    // Reset compare to auto when changing main period
    const autoPrev = getPreviousPeriod(range.from, range.to);
    setCompareRange({ from: autoPrev.from, to: autoPrev.to });
    navigate(range.from, range.to);
  }

  function handleCalendarSelect(range: DateRange | undefined) {
    setCalRange(range);
    if (range?.from && range?.to) {
      const autoPrev = getPreviousPeriod(range.from, range.to);
      setCompareRange({ from: autoPrev.from, to: autoPrev.to });
    }
  }

  function handleCompareSelect(range: DateRange | undefined) {
    setCompareRange(range);
  }

  function handleApply() {
    if (!calRange?.from || !calRange?.to) return;
    if (checkOverLimit(calRange.from, calRange.to)) return;
    navigate(calRange.from, calRange.to, compareRange?.from, compareRange?.to);
  }

  const overLimit = checkOverLimit(calRange?.from, calRange?.to);

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={`
            inline-flex items-center gap-2 px-4 py-2
            bg-[var(--bg2)] border border-[var(--border)] rounded-[10px]
            text-sm num text-[var(--t1)]
            hover:border-[var(--border-hover)] transition-all cursor-pointer
            ${isPending ? "opacity-60" : ""}
          `}
        >
          <CalendarDays className="w-4 h-4 text-[var(--t3)]" />
          {formatRangeLabel(current.from, current.to)}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          {/* Tabs */}
          <div className="flex border-b border-[var(--border)]">
            <button
              className={`flex-1 text-[12px] font-medium py-[10px] px-4 transition-colors relative ${
                activeTab === "current" ? "text-[var(--t1)]" : "text-[var(--t3)]"
              }`}
              onClick={() => setActiveTab("current")}
            >
              {t(lang, "currentPeriodTab")}
              {activeTab === "current" && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--blue)]" />
              )}
            </button>
            <button
              className={`flex-1 text-[12px] font-medium py-[10px] px-4 transition-colors relative ${
                activeTab === "compare" ? "text-[var(--t1)]" : "text-[var(--t3)]"
              }`}
              onClick={() => setActiveTab("compare")}
            >
              {t(lang, "comparePeriodTab")}
              {activeTab === "compare" && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--red)]" />
              )}
            </button>
          </div>

          {activeTab === "current" ? (
            <>
              {/* Presets */}
              <div className="flex flex-wrap gap-1 p-3 border-b border-[var(--border)]">
                {effectivePresets.map((p) => (
                  <Button
                    key={p.value}
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreset(p.value)}
                    className="text-xs h-7 px-2.5 text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--bg3)]"
                  >
                    {presetLabel(p)}
                  </Button>
                ))}
              </div>
              {/* Calendar */}
              <div className="p-3">
                <Calendar
                  mode="range"
                  selected={calRange}
                  onSelect={handleCalendarSelect}
                  numberOfMonths={2}
                  defaultMonth={new Date(current.from.getFullYear(), current.from.getMonth() - 1)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="p-3 text-[12px] text-[var(--t3)] border-b border-[var(--border)]">
                {t(lang, "comparePeriodHint")}
              </div>
              <div className="p-3">
                <Calendar
                  mode="range"
                  selected={compareRange}
                  onSelect={handleCompareSelect}
                  numberOfMonths={2}
                  defaultMonth={new Date(prev.from.getFullYear(), prev.from.getMonth() - 1)}
                />
              </div>
            </>
          )}

          {overLimit && (
            <div className="px-3 py-2 text-[11px] text-red-600 border-t border-[var(--border)]">
              {lang === "zh"
                ? `请选择不超过 ${maxRange?.weeks ?? maxRange?.months} ${maxRange?.weeks ? "周" : "个月"} 的范围(性能考虑)。`
                : `Select a range ≤ ${maxRange?.weeks ?? maxRange?.months} ${maxRange?.weeks ? "weeks" : "months"} for performance reasons.`}
            </div>
          )}

          {/* Apply / Cancel bar */}
          <div className="flex items-center justify-between p-3 border-t border-[var(--border)]">
            <span className="text-[11px] text-[var(--t4)] num">
              {calRange?.from && calRange?.to
                ? formatRangeLabel(calRange.from, calRange.to)
                : t(lang, "selectDateRange")}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-xs h-7 text-[var(--t3)]">
                {t(lang, "cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!calRange?.from || !calRange?.to || overLimit}
                className="text-xs h-7 bg-[var(--blue)] hover:bg-[#A34D2F] text-white"
              >
                {t(lang, "apply")}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <span className="text-[11px] text-[var(--t3)] num">
        {t(lang, "vsLabel")} {formatRangeLabel(prev.from, prev.to)}
      </span>
    </div>
  );
}
