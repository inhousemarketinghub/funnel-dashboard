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
} from "@/lib/dates";
import type { DateRange } from "react-day-picker";

interface Props {
  clientId: string;
}

export function DateRangePicker({ clientId }: Props) {
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
    startTransition(() => {
      router.replace(`/${clientId}?${params.toString()}`);
    });
    setOpen(false);
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
      navigate(range.from, range.to);
    }
  }

  function handleCompareSelect(range: DateRange | undefined) {
    setCompareRange(range);
    if (range?.from && range?.to && calRange?.from && calRange?.to) {
      navigate(calRange.from, calRange.to, range.from, range.to);
    }
  }

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
              Current Period
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
              Compare Period
              {activeTab === "compare" && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--red)]" />
              )}
            </button>
          </div>

          {activeTab === "current" ? (
            <>
              {/* Presets */}
              <div className="flex flex-wrap gap-1 p-3 border-b border-[var(--border)]">
                {DATE_PRESETS.map((p) => (
                  <Button
                    key={p.value}
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreset(p.value)}
                    className="text-xs h-7 px-2.5 text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--bg3)]"
                  >
                    {p.label}
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
                Select the period to compare against
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
        </PopoverContent>
      </Popover>
      <span className="text-[11px] text-[var(--t3)] num">
        vs. {formatRangeLabel(prev.from, prev.to)}
      </span>
    </div>
  );
}
