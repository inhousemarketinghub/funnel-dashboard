"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { METRIC_OPTIONS } from "./metric-selector";
import type { MonthlyTrendPoint } from "@/lib/trends";

interface TrendChartProps {
  data: MonthlyTrendPoint[];
  selectedMetrics: string[];
}

const CURRENCY_METRICS = new Set(["ad_spend", "sales", "orders", "cpl", "aov"]);
const PERCENT_METRICS = new Set(["respond_rate", "appt_rate", "showup_rate", "conv_rate", "cpa_pct"]);

function formatValue(value: number, key: string): string {
  if (CURRENCY_METRICS.has(key)) {
    if (value >= 1000) return `RM ${(value / 1000).toFixed(1)}K`;
    return `RM ${value.toFixed(0)}`;
  }
  if (PERCENT_METRICS.has(key)) {
    return `${value.toFixed(1)}%`;
  }
  return String(Math.round(value));
}

function formatYAxis(value: number, isPercent: boolean): string {
  if (isPercent) return `${value}%`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
}

export function TrendChart({ data, selectedMetrics }: TrendChartProps) {
  if (selectedMetrics.length === 0) {
    return (
      <div className="card-base">
        <div className="flex items-center justify-center h-[340px] text-[var(--t4)] text-[13px]">
          Select at least one metric to display the chart.
        </div>
      </div>
    );
  }

  const chartData = data.map((point) => {
    const row: Record<string, string | number> = { month: point.month };
    for (const key of selectedMetrics) {
      row[key] = (point.metrics as unknown as Record<string, number>)[key] ?? 0;
    }
    return row;
  });

  const hasLeft = selectedMetrics.some((k) => !PERCENT_METRICS.has(k));
  const hasRight = selectedMetrics.some((k) => PERCENT_METRICS.has(k));

  return (
    <div className="card-base">
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 8, right: hasRight ? 16 : 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "var(--t3)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          {hasLeft && (
            <YAxis
              yAxisId="left"
              orientation="left"
              tickFormatter={(v) => formatYAxis(v as number, false)}
              tick={{ fontSize: 11, fill: "var(--t3)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
          )}
          {hasRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => formatYAxis(v as number, true)}
              tick={{ fontSize: 11, fill: "var(--t3)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value, name) => [formatValue(Number(value), String(name ?? "")), String(name ?? "")]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          {selectedMetrics.map((key) => {
            const opt = METRIC_OPTIONS.find((m) => m.key === key);
            if (!opt) return null;
            const yAxisId = PERCENT_METRICS.has(key) ? "right" : "left";
            return (
              <Line
                key={key}
                yAxisId={yAxisId}
                type="monotone"
                dataKey={key}
                name={opt.label}
                stroke={opt.color}
                strokeWidth={2}
                dot={{ r: 4, fill: opt.color, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: opt.color, strokeWidth: 0 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
