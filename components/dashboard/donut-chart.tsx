"use client";
import { useEffect, useRef } from "react";
import type { FunnelMetrics } from "@/lib/types";

const SEGMENTS = [
  { key: "inquiry", label: "Inquiry", color: "var(--red)" },
  { key: "contact", label: "Contact", color: "var(--blue)" },
  { key: "appointment", label: "Appointment", color: "var(--yellow)" },
  { key: "orders", label: "Orders", color: "var(--t1)" },
] as const;

export function DonutChart({ metrics }: { metrics: FunnelMetrics }) {
  const ref = useRef<SVGSVGElement>(null);

  const total = metrics.inquiry + metrics.contact + metrics.appointment + metrics.orders;
  const segments = SEGMENTS.map((s) => ({
    ...s,
    value: metrics[s.key] as number,
    pct: total ? ((metrics[s.key] as number) / total) * 100 : 0,
  }));

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const segs = svg.querySelectorAll<SVGCircleElement>(".donut-seg");
            const circ = 2 * Math.PI * 50;
            let offset = 0;
            segs.forEach((seg, i) => {
              const pctVal = parseFloat(seg.dataset.pct || "0") / 100;
              const arc = pctVal * circ;
              const gap = 8;
              seg.setAttribute("stroke-dashoffset", String(-offset));
              setTimeout(() => {
                seg.style.strokeDasharray = `${arc - gap} ${circ - arc + gap}`;
              }, 200 + i * 150);
              offset += arc;
            });
            obs.unobserve(svg);
          }
        });
      },
      { threshold: 0.3 }
    );
    obs.observe(svg);
    return () => obs.disconnect();
  }, [metrics]);

  return (
    <div>
      <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)] mb-1">Distribution</div>
      <div className="text-[14px] font-semibold text-[var(--t1)] mb-4">Funnel Stage Mix</div>
      <div className="flex items-center gap-5">
        <svg
          ref={ref}
          viewBox="0 0 120 120"
          style={{ width: 110, height: 110, transform: "rotate(-90deg)", flexShrink: 0 }}
        >
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--sand)" strokeWidth="10"
            style={{ transition: "stroke 500ms ease" }} />
          {segments.map((s) => (
            <circle
              key={s.key}
              className="donut-seg"
              cx="60" cy="60" r="50"
              fill="none"
              stroke={s.color}
              strokeWidth="10"
              strokeLinecap="round"
              data-pct={s.pct.toFixed(1)}
              style={{
                strokeDasharray: "0 314",
                transition: "stroke-dasharray 1000ms ease",
              }}
            />
          ))}
          <text
            x="60" y="64"
            textAnchor="middle"
            className="num"
            style={{
              fontSize: 20,
              fontWeight: 700,
              fill: "var(--t1)",
              transform: "rotate(90deg)",
              transformOrigin: "center",
              transition: "fill 500ms ease",
            }}
          >
            {segments.length}
          </text>
        </svg>
        <div className="flex flex-col gap-2">
          {segments.map((s) => (
            <div key={s.key} className="flex items-center gap-[7px] text-[12px] text-[var(--t2)]">
              <span
                style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  background: s.color,
                }}
              />
              {s.label}
              <span className="num text-[14px] text-[var(--t3)] ml-auto">{s.pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
