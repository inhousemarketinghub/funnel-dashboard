import type { FunnelMetrics, KPIConfig, Achievement } from "@/lib/types";
import { fmtRM, fmtROAS, achEmoji } from "@/lib/utils";

interface Props { metrics: FunnelMetrics; kpi: KPIConfig; achievement: Achievement; }

export function HeroCards({ metrics, kpi, achievement }: Props) {
  const cards = [
    { label: "TOTAL SALES", value: fmtRM(metrics.sales), sub: `KPI: ${fmtRM(kpi.sales)} · ${achEmoji(achievement.sales)} ${achievement.sales.toFixed(0)}%` },
    { label: "ROAS", value: fmtROAS(metrics.roas), sub: `KPI: ${fmtROAS(kpi.roas)} · CPA% ${metrics.cpa_pct.toFixed(2)}%` },
    { label: "ORDERS", value: String(metrics.orders), sub: `KPI: ${kpi.orders} · ${achEmoji(achievement.orders)} ${achievement.orders.toFixed(0)}%` },
    { label: "CPL", value: fmtRM(metrics.cpl), sub: `KPI: ${fmtRM(kpi.cpl)} · ${achEmoji(achievement.cpl)}` },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-[rgba(214,211,209,0.5)] rounded-lg p-5 hover:border-[#D97706]/30 hover:-translate-y-0.5 transition-all duration-200 cursor-default">
          <div className="text-[10px] uppercase tracking-widest text-[#78716C] font-[family-name:var(--font-geist-mono)] mb-1">{c.label}</div>
          <div className="text-2xl font-bold text-[#D97706] font-[family-name:var(--font-geist-mono)]">{c.value}</div>
          <div className="text-[11px] text-[#78716C] mt-1">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
