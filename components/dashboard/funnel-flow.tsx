"use client";

import { useState, useEffect, useRef } from "react";
import type { FunnelMetrics } from "@/lib/types";
import { fmtRM } from "@/lib/utils";

const APPOINTMENT_STEPS = [
  { key: "inquiry", label: "Inquiry", colors: ["#D42B2B", "#B82424"] },
  { key: "contact", label: "Contact", colors: ["#1B4F9B", "#164082"] },
  { key: "appointment", label: "Appointment", colors: ["#D4960A", "#B88008"] },
  { key: "showup", label: "Show Up", colors: ["#777777", "#5E5E5E"] },
  { key: "orders", label: "Orders", colors: ["#444444", "#333333"] },
  { key: "sales", label: "Sales", colors: ["#111111", "#000000"] },
] as const;

const WALKIN_STEPS = [
  { key: "inquiry", label: "Inquiry", colors: ["#D42B2B", "#B82424"] },
  { key: "contact", label: "Visit", colors: ["#1B4F9B", "#164082"] },
  { key: "orders", label: "Orders", colors: ["#D4960A", "#B88008"] },
  { key: "sales", label: "Sales", colors: ["#111111", "#000000"] },
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
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } }); },
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
  const rates = STEPS.map((s) => rateMap[s.key] ?? null);

  function formatValue(idx: number, val: number) {
    if (STEPS[idx].key === "sales") return fmtRM(val);
    return val.toLocaleString();
  }

  // SVG dimensions
  const svgW = 220;
  const svgH = STEPS.length * 52 + 30;
  const cx = svgW / 2;
  const topRx = 90; // widest ellipse radius x
  const ry = 12;    // ellipse radius y (3D depth)
  const levelH = 48; // height per level
  const minRx = 25;  // narrowest level

  // Compute radii per level: strictly decreasing
  const radii: number[] = [];
  const maxVal = Math.max(values[0], 1);
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].key === "sales") {
      radii.push(Math.max(minRx, (radii[i - 1] || minRx + 10) * 0.6));
    } else {
      const raw = Math.max(minRx, (values[i] / maxVal) * topRx);
      const prev = i > 0 ? radii[i - 1] : topRx;
      radii.push(Math.min(raw, prev));
    }
  }

  return (
    <div ref={ref} className="flex gap-4 items-start">
      {/* Left labels */}
      <div className="flex flex-col" style={{ paddingTop: 8 }}>
        {STEPS.map((step, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={step.key}
              className="flex items-center gap-2 cursor-pointer transition-opacity"
              style={{
                height: levelH + 4,
                opacity: visible ? 1 : 0,
                transform: visible ? "translateX(0)" : "translateX(-10px)",
                transition: `opacity 500ms ease ${i * 100 + 200}ms, transform 500ms ease ${i * 100 + 200}ms`,
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Color dot */}
              <span
                className="w-[8px] h-[8px] rounded-full flex-shrink-0"
                style={{ background: step.colors[0] }}
              />
              <div>
                <div className={`font-label text-[10px] uppercase tracking-wider ${isHovered ? "text-[var(--t1)]" : "text-[var(--t3)]"} transition-colors`}>
                  {step.label}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`num text-[14px] font-semibold ${isHovered ? "text-[var(--t1)]" : "text-[var(--t2)]"} transition-colors`}>
                    {formatValue(i, values[i])}
                  </span>
                  {rates[i] !== null && (
                    <span className="text-[10px] text-[var(--t4)]">{rates[i]!.toFixed(1)}%</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3D SVG Funnel */}
      <div className="relative flex-shrink-0">
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
          <defs>
            {STEPS.map((step, i) => (
              <linearGradient key={`grad-${i}`} id={`funnelGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={step.colors[1]} />
                <stop offset="50%" stopColor={step.colors[0]} />
                <stop offset="100%" stopColor={step.colors[1]} />
              </linearGradient>
            ))}
          </defs>

          {STEPS.map((step, i) => {
            const topY = i * (levelH + 4) + ry;
            const bottomY = topY + levelH;
            const topR = radii[i];
            const bottomR = i < STEPS.length - 1 ? radii[i + 1] : Math.max(minRx * 0.6, topR * 0.6);
            const isHovered = hoveredIdx === i;

            // Side walls path (trapezoid connecting two ellipses)
            const wallPath = `
              M ${cx - topR} ${topY}
              L ${cx - bottomR} ${bottomY}
              A ${bottomR} ${ry} 0 0 0 ${cx + bottomR} ${bottomY}
              L ${cx + topR} ${topY}
              A ${topR} ${ry} 0 0 1 ${cx - topR} ${topY}
              Z
            `;

            return (
              <g
                key={step.key}
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(-20px)",
                  transition: `opacity 600ms ease ${i * 120}ms, transform 600ms ease ${i * 120}ms`,
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Side walls */}
                <path
                  d={wallPath}
                  fill={`url(#funnelGrad${i})`}
                  style={{
                    filter: isHovered ? "brightness(1.15)" : "brightness(1)",
                    transition: "filter 200ms ease",
                  }}
                />
                {/* Top ellipse (lighter = top surface) */}
                {i === 0 && (
                  <ellipse
                    cx={cx} cy={topY} rx={topR} ry={ry}
                    fill={step.colors[0]}
                    opacity={0.6}
                  />
                )}
                {/* Bottom ellipse (visible between levels) */}
                <ellipse
                  cx={cx} cy={bottomY} rx={bottomR} ry={ry}
                  fill={step.colors[1]}
                  opacity={0.4}
                />
                {/* Label on the funnel */}
                <text
                  x={cx} y={topY + levelH / 2 + 4}
                  textAnchor="middle"
                  className="num"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    fill: "white",
                    opacity: isHovered ? 1 : 0.8,
                    transition: "opacity 200ms ease",
                    pointerEvents: "none",
                  }}
                >
                  {step.label.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Arrow at bottom */}
          <polygon
            points={`${cx - 6},${STEPS.length * (levelH + 4) + ry + 4} ${cx + 6},${STEPS.length * (levelH + 4) + ry + 4} ${cx},${STEPS.length * (levelH + 4) + ry + 16}`}
            fill="var(--t4)"
            style={{
              opacity: visible ? 1 : 0,
              transition: `opacity 600ms ease ${STEPS.length * 120 + 200}ms`,
            }}
          />
        </svg>

        {/* Hover tooltip */}
        {hoveredIdx !== null && (
          <div
            className="tip show"
            style={{
              position: "absolute",
              top: hoveredIdx * (levelH + 4) - 8,
              left: svgW + 8,
              zIndex: 20,
              whiteSpace: "nowrap",
            }}
          >
            {STEPS[hoveredIdx].label}: {formatValue(hoveredIdx, values[hoveredIdx])}
            {rates[hoveredIdx] !== null && ` (${rates[hoveredIdx]!.toFixed(1)}%)`}
          </div>
        )}
      </div>
    </div>
  );
}
