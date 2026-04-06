"use client";
import { useEffect, useRef } from "react";
import type { FunnelMetrics } from "@/lib/types";
import { fmtRM } from "@/lib/utils";

const COLORS = ["var(--red)", "var(--blue)", "var(--yellow)", "var(--t1)"];

export function BarChart({ weeks }: { weeks: FunnelMetrics[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.querySelectorAll<HTMLElement>("[data-h]").forEach((bar, i) => {
              setTimeout(() => {
                bar.style.height = bar.dataset.h + "px";
              }, i * 70);
            });
            obs.unobserve(el);
          }
        });
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [weeks]);

  const maxSpend = Math.max(...weeks.map((w) => w.ad_spend), 1);

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-[14px] font-semibold text-[var(--t1)]">Weekly Ad Spend</div>
          <div className="text-[12px] text-[var(--t3)] mt-[3px]">Per-week breakdown</div>
        </div>
        <span className="tag tag-blue">4 Weeks</span>
      </div>
      <div
        ref={ref}
        className="flex items-end gap-[8px]"
        style={{ height: 150 }}
      >
        {weeks.map((w, i) => {
          const h = Math.max((w.ad_spend / maxSpend) * 130, 2);
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-[6px] justify-end"
              style={{ height: "100%" }}
            >
              <div
                data-h={h.toFixed(0)}
                className="w-full rounded-t-[3px] relative group"
                title={fmtRM(w.ad_spend)}
                style={{
                  height: 0,
                  background: COLORS[i % COLORS.length],
                  transition: "height 700ms ease",
                  cursor: "pointer",
                  minHeight: 2,
                }}
              />
              <span className="text-[10px] text-[var(--t4)]">W{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
