"use client";

import { useState, useEffect, useRef } from "react";

// Shared visual primitives for the Person Performance and Brand Performance
// sections: an animated breakdown donut and a small metric card.

const COLORS = ["var(--red)", "var(--blue)", "var(--yellow)", "var(--t1)", "var(--green)", "var(--t3)"];

// ── Donut with hover ──────────────────────────────────────────

export function DonutChart({ data, label, title, hoverFn }: {
  data: { name: string; value: number }[];
  label: string;
  title?: string;
  hoverFn?: (d: { name: string; value: number }) => string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } }); },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const items = data.filter((d) => d.value > 0).slice(0, 6);
  const total = items.reduce((a, d) => a + d.value, 0) || 1;
  const circ = 2 * Math.PI * 46;

  return (
    <div className="relative">
      {title && <div className="font-label text-[9px] uppercase tracking-widest text-[var(--t4)] mb-2">{title}</div>}
      <div className="flex items-center gap-3">
        <svg ref={svgRef} viewBox="0 0 120 120" style={{ width: 90, height: 90, transform: "rotate(-90deg)", flexShrink: 0 }}>
          <circle cx="60" cy="60" r="46" fill="none" stroke="var(--sand)" strokeWidth="12" />
          {items.map((d, i) => {
            const pct = d.value / total;
            const arc = pct * circ;
            const gap = 4;
            const offset = items.slice(0, i).reduce((a, x) => a + (x.value / total) * circ, 0);
            return (
              <circle key={d.name} cx="60" cy="60" r="46" fill="none" stroke={COLORS[i]} strokeWidth={hovered === i ? 15 : 12} strokeLinecap="round"
                strokeDasharray={visible ? `${arc - gap} ${circ - arc + gap}` : "0 314"} strokeDashoffset={-offset}
                style={{ transition: `stroke-dasharray 1000ms ease ${i * 150}ms, stroke-width 200ms ease`, cursor: "pointer" }}
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
            );
          })}
        </svg>
        <div className="flex flex-col gap-[4px] flex-1 min-w-0">
          {items.map((d, i) => (
            <div key={d.name} className="flex items-center gap-[5px] text-[10px]"
              style={{ color: hovered === i ? "var(--t1)" : "var(--t2)", cursor: "pointer" }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
              <span className="truncate">{d.name}</span>
              <span className="num text-[var(--t3)] ml-auto flex-shrink-0">{((d.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
      {hovered !== null && items[hovered] && (
        <div className="tip show" style={{ position: "absolute", top: -28, left: "40%", transform: "translateX(-50%)", zIndex: 20 }}>
          {hoverFn ? hoverFn(items[hovered]) : `${items[hovered].name}: ${items[hovered].value} ${label} (${((items[hovered].value / total) * 100).toFixed(1)}%)`}
        </div>
      )}
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────

export function Metric({ label, value, text, sub }: { label: string; value?: number; text?: string; sub?: string }) {
  return (
    <div className="bg-[var(--bg3)] rounded-[8px] p-[10px]" style={{ transition: "background 500ms ease" }}>
      <div className="text-[9px] text-[var(--t4)] uppercase tracking-wider mb-[3px]">{label}</div>
      <div className="num text-[16px] font-semibold text-[var(--t1)]">{text ?? value?.toLocaleString() ?? "0"}</div>
      {sub && <div className="text-[10px] text-[var(--t3)] mt-[2px]">{sub}</div>}
    </div>
  );
}
