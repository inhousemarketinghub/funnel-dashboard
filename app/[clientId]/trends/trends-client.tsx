"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MetricSelector } from "@/components/trends/metric-selector";
import { TrendChart } from "@/components/trends/trend-chart";
import { GranularityToggle } from "@/components/trends/granularity-toggle";
import { ComparisonToggle } from "@/components/trends/comparison-toggle";
import { TrendAvgCards } from "@/components/trends/trend-avg-cards";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import {
  formatRangeLabel,
  formatDateParam,
  getDefaultRange,
  MONTHLY_PRESETS,
  WEEKLY_PRESETS,
  type Granularity,
  type DateRangeObj,
} from "@/lib/dates";
import type { TrendBundle } from "@/lib/trends";

interface TrendsClientProps {
  bundle: TrendBundle;
  brands: string[];
  selectedBrand: string | null;
  clientId: string;
  granularity: Granularity;
  range: DateRangeObj;
  compare: boolean;
  comparisonRange: DateRangeObj | null;
}

export function TrendsClient({
  bundle,
  brands,
  selectedBrand,
  clientId,
  granularity,
  range,
  compare,
  comparisonRange,
}: TrendsClientProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["sales", "cpl", "conv_rate"]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const hasMultiBrand = brands.length > 1;

  function buildBaseParams(): URLSearchParams {
    const params = new URLSearchParams();
    params.set("granularity", granularity);
    params.set("from", formatDateParam(range.from));
    params.set("to", formatDateParam(range.to));
    if (selectedBrand) params.set("brand", selectedBrand);
    if (compare) {
      params.set("compare", "1");
      if (comparisonRange) {
        params.set("prevFrom", formatDateParam(comparisonRange.from));
        params.set("prevTo", formatDateParam(comparisonRange.to));
      }
    }
    return params;
  }

  function handleBrandChange(brand: string) {
    const params = buildBaseParams();
    if (brand !== "Overall") params.set("brand", brand);
    else params.delete("brand");
    startTransition(() => {
      router.push(`/${clientId}/trends?${params.toString()}`);
    });
  }

  function handleGranularityChange(next: Granularity) {
    const defaultRange = getDefaultRange(next);
    const params = new URLSearchParams();
    params.set("granularity", next);
    params.set("from", formatDateParam(defaultRange.from));
    params.set("to", formatDateParam(defaultRange.to));
    if (selectedBrand) params.set("brand", selectedBrand);
    // Preserve compare flag; let server re-derive comparison range for new granularity.
    if (compare) params.set("compare", "1");
    startTransition(() => {
      router.push(`/${clientId}/trends?${params.toString()}`);
    });
  }

  function handleCompareChange(next: boolean) {
    const params = new URLSearchParams();
    params.set("granularity", granularity);
    params.set("from", formatDateParam(range.from));
    params.set("to", formatDateParam(range.to));
    if (selectedBrand) params.set("brand", selectedBrand);
    if (next) {
      params.set("compare", "1");
      // Don't carry prevFrom/prevTo — let server derive default from granularity.
    }
    startTransition(() => {
      router.push(`/${clientId}/trends?${params.toString()}`);
    });
  }

  const subtitleCount =
    granularity === "weekly"
      ? Math.round((range.to.getTime() - range.from.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
      : (range.to.getFullYear() - range.from.getFullYear()) * 12 +
        (range.to.getMonth() - range.from.getMonth()) + 1;
  const unit = granularity === "weekly" ? "weeks" : "months";

  const dateRangeExtraParams: Record<string, string> = { granularity };
  if (selectedBrand) dateRangeExtraParams.brand = selectedBrand;
  if (compare) dateRangeExtraParams.compare = "1";

  return (
    <div>
      <div className="flex justify-between items-start mb-7">
        <div>
          <h1 className="font-heading text-[22px] font-semibold text-[var(--t1)]">Historical Trends</h1>
          <p className="text-[14px] text-[var(--t3)] font-light mt-[3px]">
            {granularity === "weekly" ? "Weekly" : "Monthly"} performance · {formatRangeLabel(range.from, range.to)} ({subtitleCount} {unit})
            {selectedBrand && <span className="ml-1">— {selectedBrand}</span>}
            {compare && comparisonRange && (
              <span className="ml-2 text-[12px] text-[var(--t4)]">
                vs {formatRangeLabel(comparisonRange.from, comparisonRange.to)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <GranularityToggle
            value={granularity}
            onChange={handleGranularityChange}
            pending={isPending}
          />
          <ComparisonToggle
            value={compare}
            onChange={handleCompareChange}
            pending={isPending}
          />
          <DateRangePicker
            clientId={clientId}
            basePath={`/${clientId}/trends`}
            presets={granularity === "weekly" ? WEEKLY_PRESETS : MONTHLY_PRESETS}
            maxRange={granularity === "weekly" ? { weeks: 104 } : { months: 24 }}
            extraParams={dateRangeExtraParams}
          />
          {hasMultiBrand && (
            <select
              value={selectedBrand || "Overall"}
              onChange={(e) => handleBrandChange(e.target.value)}
              className="px-3 py-2 border border-[var(--border)] rounded-lg text-[12px] bg-[var(--bg)] text-[var(--t2)]"
            >
              <option value="Overall">All Brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="card-base mb-4 p-4">
        <div className="font-label text-[11px] uppercase text-[var(--t3)] mb-3" style={{ letterSpacing: "0.2em" }}>
          Metrics
        </div>
        <MetricSelector
          selected={selectedMetrics}
          onChange={setSelectedMetrics}
          maxSelect={5}
        />
      </div>

      <TrendAvgCards
        avgCurrent={bundle.avgCurrent}
        avgComparison={bundle.avgComparison}
        selectedMetrics={selectedMetrics}
        compare={compare}
      />

      <TrendChart
        data={bundle.current}
        comparison={bundle.comparison}
        selectedMetrics={selectedMetrics}
      />
    </div>
  );
}
