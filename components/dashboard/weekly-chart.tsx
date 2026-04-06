"use client";

import { useState, useEffect, useRef } from "react";
import type { FunnelMetrics } from "@/lib/types";
import { fmtRM } from "@/lib/utils";

interface Props {
  weeks: FunnelMetrics[];
}

const METRICS = [
  { key: "ad_spend" as const, label: "Ad Spend", color: "var(--red)", format: (v: number) => fmtRM(v) },
  { key: "showup" as const, label: "Show Up", color: "var(--blue)", format: (v: number) => String(v) },
  { key: "sales" as const, label: "Sales", color: "var(--yellow)", format: (v: number) => fmtRM(v) },
];

export function WeeklyChart({ weeks }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState<{ week: number; metric: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { setVisible(true); obs.unobserve(el); }
        });
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Find max value per metric for scaling
  const maxValues = METRICS.map((m) =>
    Math.max(...weeks.map((w) => w[m.key] as number), 1)
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-[14px] font-semibold text-[var(--t1)]">Weekly Breakdown</div>
        <div className="flex gap-4">
          {METRICS.map((m) => (
            <div key={m.key} className="flex items-center gap-[6px] text-[11px] text-[var(--t3)]">
              <span className="inline-block w-[10px] h-[10px] rounded-[2px]" style={{ background: m.color }} />
              {m.label}
            </div>
          ))}
        </div>
      </div>
      <div ref={ref} className="flex items-end gap-[16px]" style={{ height: 180 }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex-1 flex items-end gap-[3px]" style={{ height: "100%" }}>
            {METRICS.map((m, mi) => {
              const val = week[m.key] as number;
              const h = Math.max((val / maxValues[mi]) * 150, 2);
              const isHovered = hovered?.week === wi && hovered?.metric === mi;

              return (
                <div
                  key={m.key}
                  className="flex-1 flex flex-col items-center justify-end relative"
                  style={{ height: "100%" }}
                  onMouseEnter={() => setHovered({ week: wi, metric: mi })}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className="w-full rounded-t-[3px]"
                    style={{
                      height: visible ? h : 0,
                      background: m.color,
                      transition: `height 700ms ease ${(wi * 3 + mi) * 40}ms`,
                      cursor: "pointer",
                      opacity: isHovered ? 0.8 : 1,
                    }}
                  />
                  {isHovered && (
                    <div
                      className="tip show"
                      style={{
                        position: "absolute",
                        top: -32,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 20,
                      }}
                    >
                      W{wi + 1} {m.label}: {m.format(val)}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="text-[10px] text-[var(--t4)] text-center w-full absolute -bottom-5">
              W{wi + 1}
            </div>
          </div>
        ))}
      </div>
      {/* Week labels */}
      <div className="flex gap-[16px] mt-2">
        {weeks.map((_, wi) => (
          <div key={wi} className="flex-1 text-center text-[10px] text-[var(--t4)]">
            W{wi + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
