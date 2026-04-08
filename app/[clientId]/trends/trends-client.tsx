"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MetricSelector } from "@/components/trends/metric-selector";
import { TrendChart } from "@/components/trends/trend-chart";
import type { MonthlyTrendPoint } from "@/lib/trends";

interface TrendsClientProps {
  data: MonthlyTrendPoint[];
  brands: string[];
  selectedBrand: string | null;
  clientId: string;
}

export function TrendsClient({ data, brands, selectedBrand, clientId }: TrendsClientProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["sales", "cpl", "conv_rate"]);
  const router = useRouter();
  const hasMultiBrand = brands.length > 1;

  function handleBrandChange(brand: string) {
    const params = new URLSearchParams();
    if (brand !== "Overall") params.set("brand", brand);
    router.push(`/${clientId}/trends${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-7">
        <div>
          <h1 className="font-heading text-[22px] font-semibold text-[var(--t1)]">Historical Trends</h1>
          <p className="text-[14px] text-[var(--t3)] font-light mt-[3px]">
            Monthly performance over the last 6 months
            {selectedBrand && <span className="ml-1">— {selectedBrand}</span>}
          </p>
        </div>
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
