"use client";

import { useState, useEffect, useRef } from "react";
import type { FunnelMetrics } from "@/lib/types";
import { fmtRM } from "@/lib/utils";

const APPOINTMENT_STEPS = [
  { key: "inquiry", label: "Inquiry", color: "var(--red)" },
  { key: "contact", label: "Contact", color: "var(--blue)" },
  { key: "appointment", label: "Appointment", color: "var(--yellow)" },
  { key: "showup", label: "Show Up", color: "var(--t3)" },
  { key: "orders", label: "Orders", color: "var(--t4)" },
  { key: "sales", label: "Sales", color: "var(--t1)" },
] as const;

const WALKIN_STEPS = [
  { key: "inquiry", label: "Inquiry", color: "var(--red)" },
  { key: "contact", label: "Visit", color: "var(--blue)" },
  { key: "orders", label: "Orders", color: "var(--t3)" },
  { key: "sales", label: "Sales", color: "var(--t1)" },
] as const;

export function FunnelFlow({ metrics, funnelType = "appointment" }: { metrics: FunnelMetrics; funnelType?: string }) {
  const STEPS = funnelType === "walkin" ? WALKIN_STEPS : APPOINTMENT_STEPS;
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { setVisible(true); obs.unobserve(el); }
        });
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const valueMap: Record<string, number> = {
    inquiry: metrics.inquiry, contact: metrics.contact,
    appointment: metrics.appointment, showup: metrics.showup,
    orders: metrics.orders, sales: metrics.sales,
  };
  const rateMap: Record<string, number | null> = {
    inquiry: null, contact: metrics.respond_rate,
    appointment: metrics.appt_rate, showup: metrics.showup_rate,
    orders: metrics.conv_rate, sales: null,
  };
  const values = STEPS.map((s) => valueMap[s.key] ?? 0);
  const maxVal = Math.max(values[0], 1);
  const rates = STEPS.map((s) => rateMap[s.key] ?? null);
  const lastIdx = STEPS.length - 1;

  function formatValue(idx: number, val: number) {
    if (STEPS[idx].key === "sales") return fmtRM(val);
    return val.toLocaleString();
  }

  // Pre-compute widths ensuring strictly decreasing funnel shape
  const widthPcts: number[] = [];
  for (let idx = 0; idx < STEPS.length; idx++) {
    if (STEPS[idx].key === "sales") {
      // Sales step: slightly narrower than previous
      widthPcts.push(Math.max(15, (widthPcts[idx - 1] || 30) * 0.7));
    } else {
      const raw = Math.max(15, (values[idx] / maxVal) * 100);
      // Ensure this step is never wider than the previous
      const prev = idx > 0 ? widthPcts[idx - 1] : 100;
      widthPcts.push(Math.min(raw, prev));
    }
  }

  function getWidths(idx: number): { topPct: number; bottomPct: number } {
    const topPct = widthPcts[idx];
    const bottomPct = idx < lastIdx ? widthPcts[idx + 1] : Math.max(15, topPct * 0.7);
    return { topPct, bottomPct };
  }

  return (
    <div ref={ref}>
      {STEPS.map((step, i) => {
        const { topPct, bottomPct } = getWidths(i);
        // clip-path to create trapezoid: wider at top, narrower at bottom
        const insetL = (100 - topPct) / 2;
        const insetR = 100 - insetL;
        const insetLBottom = (100 - bottomPct) / 2;
        const insetRBottom = 100 - insetLBottom;
        const clipPath = visible
          ? `polygon(${insetL}% 0%, ${insetR}% 0%, ${insetRBottom}% 100%, ${insetLBottom}% 100%)`
          : `polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%)`; // collapsed

        return (
          <div
            key={step.key}
            className="flex items-center gap-3 relative"
            style={{ marginBottom: 1 }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {/* Trapezoid shape */}
            <div className="flex-1 relative" style={{ height: 34 }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: step.color,
                  clipPath,
                  transition: `clip-path 800ms ease ${i * 80}ms`,
                  cursor: "pointer",
                }}
              />
            </div>
            {/* Labels outside the shape */}
            <div className="flex items-center gap-2 min-w-[160px]">
              <span className="font-label text-[11px] uppercase tracking-wider text-[var(--t3)] min-w-[80px]">
                {step.label}
              </span>
              <span className="num text-[14px] font-semibold text-[var(--t1)]">
                {formatValue(i, values[i])}
              </span>
              {rates[i] !== null && (
                <span className="text-[11px] text-[var(--t4)]">
                  {rates[i]!.toFixed(1)}%
                </span>
              )}
            </div>

            {/* Tooltip */}
            {hoveredIdx === i && (
              <div
                className="tip show"
                style={{
                  position: "absolute",
                  top: -28,
                  left: "30%",
                  transform: "translateX(-50%)",
                  zIndex: 20,
                }}
              >
                {step.label}: {formatValue(i, values[i])}
                {rates[i] !== null && ` (${rates[i]!.toFixed(1)}%)`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
