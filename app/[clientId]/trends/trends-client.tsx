"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MetricSelector } from "@/components/trends/metric-selector";
import { TrendChart } from "@/components/trends/trend-chart";
import { GranularityToggle } from "@/components/trends/granularity-toggle";
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
import type { TrendPoint } from "@/lib/trends";

interface TrendsClientProps {
  data: TrendPoint[];
  brands: string[];
  selectedBrand: string | null;
  clientId: string;
  granularity: Granularity;
  range: DateRangeObj;
}

export function TrendsClient({
  data,
  brands,
  selectedBrand,
  clientId,
  granularity,
  range,
}: TrendsClientProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["sales", "cpl", "conv_rate"]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const hasMultiBrand = brands.length > 1;

  function handleBrandChange(brand: string) {
    const params = new URLSearchParams();
    params.set("granularity", granularity);
    params.set("from", formatDateParam(range.from));
    params.set("to", formatDateParam(range.to));
    if (brand !== "Overall") params.set("brand", brand);
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

  return (
    <div>
      <div className="flex justify-between items-start mb-7">
        <div>
          <h1 className="font-heading text-[22px] font-semibold text-[var(--t1)]">Historical Trends</h1>
          <p className="text-[14px] text-[var(--t3)] font-light mt-[3px]">
            {granularity === "weekly" ? "Weekly" : "Monthly"} performance · {formatRangeLabel(range.from, range.to)} ({subtitleCount} {unit})
            {selectedBrand && <span className="ml-1">— {selectedBrand}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GranularityToggle
            value={granularity}
            onChange={handleGranularityChange}
            pending={isPending}
          />
          <DateRangePicker
            clientId={clientId}
            basePath={`/${clientId}/trends`}
            presets={granularity === "weekly" ? WEEKLY_PRESETS : MONTHLY_PRESETS}
            maxRange={granularity === "weekly" ? { weeks: 104 } : { months: 24 }}
            extraParams={{
              granularity,
              ...(selectedBrand ? { brand: selectedBrand } : {}),
            }}
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

      <TrendChart data={data} selectedMetrics={selectedMetrics} />
    </div>
  );
}
