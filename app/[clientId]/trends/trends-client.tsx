"use client";

import { useState } from "react";
import { MetricSelector } from "@/components/trends/metric-selector";
import { TrendChart } from "@/components/trends/trend-chart";
import type { MonthlyTrendPoint } from "@/lib/trends";

interface TrendsClientProps {
  data: MonthlyTrendPoint[];
}

export function TrendsClient({ data }: TrendsClientProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["sales", "cpl", "conv_rate"]);

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-heading text-[22px] font-semibold text-[var(--t1)]">Historical Trends</h1>
        <p className="text-[14px] text-[var(--t3)] font-light mt-[3px]">
          Monthly performance over the last 6 months
        </p>
      </div>

      <div className="card-base mb-[10px] p-4">
        <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)] mb-3">
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
