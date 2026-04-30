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
import { getMetricOptionsForFunnel } from "./metric-selector";
import type { TrendPoint } from "@/lib/trends";
import { momPct } from "@/lib/utils";
import { INVERTED_METRICS } from "@/components/shared/mom-badge";

interface TrendChartProps {
  data: TrendPoint[];
  comparison?: TrendPoint[];
  selectedMetrics: string[];
  funnelType?: string;
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

type DotPayload = { isPartial?: boolean; cmpIsPartial?: boolean };

function renderDot(
  color: string,
  partialKey: "isPartial" | "cmpIsPartial" = "isPartial",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (props: any) => React.ReactElement {
  const Dot = (props: {
    cx?: number;
    cy?: number;
    payload?: DotPayload;
    key?: React.Key | null;
  }) => {
    const { cx, cy, payload, key } = props;
    if (cx === undefined || cy === undefined) return <g key={key ?? undefined} />;
    const isPartial = payload?.[partialKey];
    if (isPartial) {
      return (
        <circle key={key ?? undefined} cx={cx} cy={cy} r={4} fill="var(--bg)" stroke={color} strokeWidth={2} />
      );
    }
    return <circle key={key ?? undefined} cx={cx} cy={cy} r={4} fill={color} />;
  };
  Dot.displayName = "PartialAwareDot";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Dot as (props: any) => React.ReactElement;
}

interface TooltipRow {
  label: string;
  cmpLabel?: string | null;
  isPartial?: boolean;
  cmpIsPartial?: boolean;
  [k: string]: unknown;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: TooltipRow }[];
  selectedMetrics: string[];
  hasComparison: boolean;
  funnelType: string;
}

function CustomTooltip({ active, payload, selectedMetrics, hasComparison, funnelType }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const label = row.isPartial ? `(incomplete) ${row.label}` : row.label;
  const cmpLabel = hasComparison && row.cmpLabel
    ? (row.cmpIsPartial ? `(incomplete) ${row.cmpLabel}` : row.cmpLabel)
    : null;
  const options = getMetricOptionsForFunnel(funnelType);

  return (
    <div
      style={{
        backgroundColor: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        minWidth: 220,
      }}
    >
      <div className="text-[11px] font-medium text-[var(--t1)] mb-1">{label}</div>
      {cmpLabel && (
        <div className="text-[10px] text-[var(--t4)] mb-2">vs {cmpLabel}</div>
      )}
      {selectedMetrics.map((key) => {
        const opt = options.find((m) => m.key === key);
        if (!opt) return null;
        const cur = Number(row[key] ?? 0);
        const prev = hasComparison ? Number(row[`${key}__cmp`] ?? 0) : null;
        const delta = prev !== null ? momPct(cur, prev) : null;
        const inverted = INVERTED_METRICS.has(key);
        const isGood = delta === null ? false : (inverted ? delta < 0 : delta > 0);
        const deltaColor = delta === null ? "var(--t4)" : (isGood ? "var(--green)" : "var(--red)");
        const sign = delta !== null && delta > 0 ? "+" : "";
        return (
          <div key={key} className="flex items-center justify-between gap-3 py-[2px]">
            <span className="flex items-center gap-1.5">
              <span style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: opt.color, display: "inline-block" }} />
              <span className="text-[var(--t2)]">{opt.label}</span>
            </span>
            <span className="num text-[var(--t1)]">
              {formatValue(cur, key)}
              {hasComparison && (
                <>
                  <span className="text-[var(--t4)]"> vs </span>
                  <span className="text-[var(--t3)]">{formatValue(Number(prev ?? 0), key)}</span>
                  {delta !== null && (
                    <span className="ml-1 text-[10px]" style={{ color: deltaColor }}>
                      ({sign}{delta.toFixed(1)}%)
                    </span>
                  )}
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TrendChart({ data, comparison, selectedMetrics, funnelType = "appointment" }: TrendChartProps) {
  const visibleOptions = getMetricOptionsForFunnel(funnelType);
  const visibleKeys = new Set(visibleOptions.map((o) => o.key));
  // Defensive: if user has stale selected metrics from a different funnel type, drop those keys.
  const visibleSelected = selectedMetrics.filter((k) => visibleKeys.has(k));

  if (visibleSelected.length === 0) {
    return (
      <div className="card-base">
        <div className="flex items-center justify-center h-[340px] text-[var(--t4)] text-[13px]">
          Select at least one metric to display the chart.
        </div>
      </div>
    );
  }

  const hasComparison = !!comparison && comparison.length > 0;
  const chartData = data.map((point, i) => {
    const cmp = hasComparison ? comparison![i] : undefined;
    const row: Record<string, string | number | boolean | null> = {
      label: point.label,
      isPartial: point.isPartial,
      cmpLabel: cmp?.label ?? null,
      cmpIsPartial: cmp?.isPartial ?? false,
    };
    for (const key of visibleSelected) {
      row[key] = (point.metrics as unknown as Record<string, number>)[key] ?? 0;
      if (cmp) {
        row[`${key}__cmp`] = (cmp.metrics as unknown as Record<string, number>)[key] ?? 0;
      }
    }
    return row;
  });

  const hasLeft = visibleSelected.some((k) => !PERCENT_METRICS.has(k));
  const hasRight = visibleSelected.some((k) => PERCENT_METRICS.has(k));
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
            content={
              <CustomTooltip
                selectedMetrics={visibleSelected}
                hasComparison={hasComparison}
                funnelType={funnelType}
              />
            }
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {visibleSelected.map((key) => {
            const opt = visibleOptions.find((m) => m.key === key);
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
                dot={renderDot(opt.color, "isPartial")}
                activeDot={{ r: 6, fill: opt.color, strokeWidth: 0 }}
              />
            );
          })}
          {hasComparison && visibleSelected.map((key) => {
            const opt = visibleOptions.find((m) => m.key === key);
            if (!opt) return null;
            const yAxisId = PERCENT_METRICS.has(key) ? "right" : "left";
            return (
              <Line
                key={`${key}__cmp`}
                yAxisId={yAxisId}
                type="monotone"
                dataKey={`${key}__cmp`}
                name={`${opt.label} (prev)`}
                stroke={opt.color}
                strokeOpacity={0.45}
                strokeDasharray="4 4"
                strokeWidth={2}
                dot={renderDot(opt.color, "cmpIsPartial")}
                activeDot={{ r: 5, fill: opt.color, opacity: 0.6, strokeWidth: 0 }}
                legendType="none"
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
