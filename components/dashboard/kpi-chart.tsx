"use client";

import { useState, useEffect, useRef } from "react";

interface KPIItem {
  label: string;
  value: number;
  target: string;
  actual: string;
  prevActual?: string;
  monthlyTarget?: string;
}

function getStatus(value: number): { color: string; text: string } {
  if (value >= 100) return { color: "var(--green)", text: "Excellent" };
  if (value >= 80) return { color: "var(--yellow)", text: "Warning" };
  return { color: "var(--red)", text: "Poor" };
}

export function KPIChart({ items }: { items: KPIItem[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const maxScale = 150;

  return (
    <div ref={ref}>
      {items.map((item, i) => {
        const status = getStatus(item.value);
        const currentWidth = Math.min((item.value / maxScale) * 100, 100);
        const targetPos = (100 / maxScale) * 100;

        return (
          <div
            key={item.label}
            className="flex items-center gap-3 py-[10px] border-b border-[var(--border)] last:border-b-0 relative"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ transition: "border-color 500ms ease" }}
          >
            <span className="text-[13px] font-medium min-w-[120px] text-[var(--t1)]" style={{ transition: "color 500ms ease" }}>
              {item.label}
            </span>
            <div className="flex-1 relative">
              <div
                className="h-[8px] rounded-[4px] relative overflow-visible"
                style={{ background: "var(--sand)", transition: "background 500ms ease" }}
              >
                {/* Current period bar — color by status */}
                <div
                  className="h-full rounded-[4px] absolute top-0 left-0"
                  style={{
                    width: visible ? `${currentWidth}%` : "0%",
                    background: status.color,
                    transition: `width 1000ms ease ${i * 80}ms`,
                  }}
                />
                {/* KPI Target dashed line */}
                <div
                  className="absolute top-[-4px] bottom-[-4px] w-0"
                  style={{
                    left: `${targetPos}%`,
                    borderLeft: "2px dashed var(--t3)",
                    zIndex: 2,
                  }}
                />
              </div>
            </div>
            {/* Status label instead of percentage */}
            <span
              className="text-[11px] font-semibold min-w-[70px] text-right"
              style={{ color: status.color, transition: "color 500ms ease" }}
            >
              {status.text}
            </span>

            {/* Hover tooltip */}
            {hovered === i && (
              <div
                className="tip show"
                style={{
                  position: "absolute",
                  top: -28,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 20,
                }}
              >
                {item.label}: {item.actual} / {item.target}
                {item.monthlyTarget && ` / ${item.monthlyTarget}`}
                {item.prevActual && ` / Prev: ${item.prevActual}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
