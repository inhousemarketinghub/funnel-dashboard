"use client";

import type { FunnelMetrics } from "@/lib/types";
import { momPct } from "@/lib/utils";
import { CountUp } from "@/components/animations/count-up";
import { MoMBadge, INVERTED_METRICS } from "@/components/shared/mom-badge";
import { METRIC_OPTIONS, type MetricOption } from "./metric-selector";

interface Props {
  avgCurrent: FunnelMetrics;
  avgComparison?: FunnelMetrics;
  selectedMetrics: string[];
  compare: boolean;
}

const ACCENT_COLORS = ["accent-red", "accent-blue", "accent-yellow", "accent-black", "accent-red"];

function getDisplayConfig(opt: MetricOption): { prefix?: string; suffix?: string; decimals: number } {
  if (opt.unit === "currency") return { prefix: "RM ", decimals: 2 };
  if (opt.unit === "percent") return { suffix: "%", decimals: 1 };
  return { decimals: 0 };
}

export function TrendAvgCards({ avgCurrent, avgComparison, selectedMetrics, compare }: Props) {
  const cards = METRIC_OPTIONS.filter((opt) => selectedMetrics.includes(opt.key));
  if (cards.length === 0) return null;

  const showComparison = compare && !!avgComparison;

  return (
    <div className="card-base mb-4 p-4">
      <div className="font-label text-[11px] uppercase text-[var(--t3)] mb-3" style={{ letterSpacing: "0.2em" }}>
        Period Average
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((opt, i) => {
          const accent = ACCENT_COLORS[i % ACCENT_COLORS.length];
          const current = (avgCurrent as unknown as Record<string, number>)[opt.key] ?? 0;
          const previous = showComparison
            ? ((avgComparison as unknown as Record<string, number>)[opt.key] ?? 0)
            : 0;
          const delta = showComparison ? momPct(current, previous) : null;
          const display = getDisplayConfig(opt);
          return (
            <div key={opt.key} className={`card-base accent-top ${accent}`}>
              <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t3)] mb-1">
                Avg {opt.label}
              </div>
              <div className="text-[22px] font-bold tracking-tight text-[var(--t1)] leading-none mb-2 num">
                <CountUp value={current} prefix={display.prefix} suffix={display.suffix} decimals={display.decimals} />
              </div>
              {showComparison && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <MoMBadge value={delta} inverted={INVERTED_METRICS.has(opt.key)} />
                  <span className="text-[var(--t4)]">vs prev</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
