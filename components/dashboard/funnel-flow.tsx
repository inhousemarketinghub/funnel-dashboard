import type { FunnelMetrics } from "@/lib/types";
import { fmtRM } from "@/lib/utils";

const STEPS = [
  { key: "ad_spend" as const, label: "AD SPEND", icon: "💲", fmt: (v: number) => fmtRM(v) },
  { key: "inquiry" as const, label: "INQUIRY", icon: "💬", fmt: (v: number) => String(v) },
  { key: "contact" as const, label: "CONTACT", icon: "👥", fmt: (v: number) => String(v) },
  { key: "appointment" as const, label: "APPT", icon: "📅", fmt: (v: number) => String(v) },
  { key: "showup" as const, label: "SHOW UP", icon: "📍", fmt: (v: number) => String(v) },
  { key: "orders" as const, label: "ORDERS", icon: "✅", fmt: (v: number) => String(v) },
  { key: "sales" as const, label: "SALES", icon: "💵", fmt: (v: number) => fmtRM(v) },
];

export function FunnelFlow({ metrics }: { metrics: FunnelMetrics }) {
  return (
    <div className="flex items-center flex-wrap gap-0 bg-white border border-[rgba(214,211,209,0.5)] rounded-lg p-5 mb-6">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className="text-center px-3 py-2 rounded-lg hover:bg-[#FAFAF9] hover:-translate-y-0.5 transition-all duration-200 cursor-default">
            <div className="text-xl mb-1">{step.icon}</div>
            <div className="text-[10px] uppercase tracking-widest text-[#78716C] font-[family-name:var(--font-geist-mono)]">{step.label}</div>
            <div className="text-sm font-semibold text-[#1C1917] font-[family-name:var(--font-geist-mono)]">{step.fmt(metrics[step.key])}</div>
          </div>
          {i < STEPS.length - 1 && (
            <svg width="16" height="16" viewBox="0 0 20 20" className="text-[rgba(214,211,209,0.8)] mx-1 shrink-0">
              <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
