"use client";

import React from "react";
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
import type { TrendPoint } from "@/lib/trends";

interface TrendChartProps {
  data: TrendPoint[];
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
  if (value >= 1000) return `RM ${(value / 1000).toFixed(0)}K`;
  return `RM ${value}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderDot(color: string): (props: any) => React.ReactElement {
  return (props) => {
    const { cx, cy, payload, key } = props;
    if (cx === undefined || cy === undefined) return <g key={key} />;
    if (payload?.isPartial) {
      return (
        <circle key={key} cx={cx} cy={cy} r={4} fill="var(--bg)" stroke={color} strokeWidth={2} />
      );
    }
    return <circle key={key} cx={cx} cy={cy} r={4} fill={color} />;
  };
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
    const row: Record<string, string | number | boolean> = {
      label: point.label,
      isPartial: point.isPartial,
    };
    for (const key of selectedMetrics) {
      row[key] = (point.metrics as unknown as Record<string, number>)[key] ?? 0;
    }
    return row;
  });

  const hasLeft = selectedMetrics.some((k) => !PERCENT_METRICS.has(k));
  const hasRight = selectedMetrics.some((k) => PERCENT_METRICS.has(k));
  const isEmptyRange =
    data.length > 0 &&
    data.every((p) => Object.values(p.metrics).every((v) => v === 0));

  return (
    <div className="card-base">
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 8, right: hasRight ? 16 : 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
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
            labelFormatter={(label, payload) => {
              const pp = payload?.[0]?.payload as { isPartial?: boolean } | undefined;
              return pp?.isPartial ? `(incomplete) ${label}` : String(label);
            }}
            formatter={(value, name) => [formatValue(Number(value), String(name ?? "")), String(name ?? "")]}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
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
                dot={renderDot(opt.color)}
                activeDot={{ r: 6, fill: opt.color, strokeWidth: 0 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
      {isEmptyRange && (
        <div className="text-[11px] text-[var(--t3)] mt-2 text-center">
          No data in selected range. Check the sheet or pick a different period.
        </div>
      )}
    </div>
  );
}
