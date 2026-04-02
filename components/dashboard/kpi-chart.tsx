"use client";
import { useState } from "react";

interface KPIItem { label: string; value: number; target: string; actual: string; }

export function KPIChart({ items }: { items: KPIItem[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxPct = 120;

  return (
    <div className="bg-white border border-[rgba(214,211,209,0.5)] rounded-lg p-6">
      <h3 className="font-[family-name:var(--font-geist-sans)] font-bold text-[15px] tracking-tight mb-1">KPI Achievement</h3>
      <p className="text-[11px] text-[#78716C] mb-4">Red line = KPI target · Hover for details</p>
      <div className="space-y-2">
        {items.map((item, i) => {
          const barPct = Math.min(item.value / maxPct * 100, 100);
          const color = item.value >= 100 ? "#16A34A" : item.value >= 80 ? "#CA8A04" : "#DC2626";
          return (
            <div key={item.label} className="flex items-center gap-3 h-8 relative"
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <div className="w-28 text-right text-[11px] font-semibold text-[#78716C] font-[family-name:var(--font-geist-mono)] shrink-0">{item.label}</div>
              <div className="flex-1 h-5 bg-[#F5F5F4] rounded-md relative cursor-pointer">
                <div className="h-full rounded-md transition-all duration-300 flex items-center justify-end pr-2"
                  style={{ width: `${barPct}%`, background: color }}>
                  {barPct >= 30 && <span className="text-[11px] font-bold text-white font-[family-name:var(--font-geist-mono)]">{item.value.toFixed(0)}%</span>}
                </div>
                {barPct < 30 && (
                  <span className="absolute text-[11px] font-bold font-[family-name:var(--font-geist-mono)]"
                    style={{ left: `${barPct + 2}%`, top: "50%", transform: "translateY(-50%)", color }}>
                    {item.value.toFixed(0)}%
                  </span>
                )}
                <div className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-[#DC2626]" style={{ left: `${100 / maxPct * 100}%` }} />
                {hovered === i && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-[rgba(214,211,209,0.5)] rounded-lg p-3 shadow-lg z-10 min-w-[180px]">
                    <div className="font-bold text-[13px] text-[#1C1917] mb-2 pb-1 border-b border-[rgba(214,211,209,0.5)]">{item.label}</div>
                    <div className="flex justify-between text-[12px] font-[family-name:var(--font-geist-mono)] text-[#78716C] py-0.5"><span>Target</span><b className="text-[#1C1917]">{item.target}</b></div>
                    <div className="flex justify-between text-[12px] font-[family-name:var(--font-geist-mono)] text-[#78716C] py-0.5"><span>Actual</span><b className="text-[#1C1917]">{item.actual}</b></div>
                    <div className="flex justify-between text-[12px] font-[family-name:var(--font-geist-mono)] text-[#78716C] py-0.5"><span>Achievement</span><b style={{ color }}>{item.value.toFixed(0)}%</b></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
