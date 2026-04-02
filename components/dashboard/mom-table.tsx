"use client";
import type { FunnelMetrics, KPIConfig, MoMResult } from "@/lib/types";
import { fmtRM, fmtROAS, kpiColorClass } from "@/lib/utils";

interface FunnelRow {
  label: string; tmFmt: string; lmFmt: string; mom: number | null;
  kpiFmt: string; inverted: boolean; tmRaw: number | null; kpiRaw: number | null;
}

function buildRows(tm: FunnelMetrics, lm: FunnelMetrics, mom: MoMResult, kpi: KPIConfig): FunnelRow[] {
  return [
    { label: "Total Sales", tmFmt: fmtRM(tm.sales), lmFmt: fmtRM(lm.sales), mom: mom.sales ?? null, kpiFmt: fmtRM(kpi.sales), inverted: false, tmRaw: tm.sales, kpiRaw: kpi.sales },
    { label: "Ad Spend", tmFmt: fmtRM(tm.ad_spend), lmFmt: fmtRM(lm.ad_spend), mom: mom.ad_spend ?? null, kpiFmt: fmtRM(kpi.ad_spend), inverted: false, tmRaw: tm.ad_spend, kpiRaw: kpi.ad_spend },
    { label: "Inquiry", tmFmt: String(tm.inquiry), lmFmt: String(lm.inquiry), mom: mom.inquiry ?? null, kpiFmt: String(Math.round(kpi.ad_spend / kpi.cpl)), inverted: false, tmRaw: tm.inquiry, kpiRaw: kpi.ad_spend / kpi.cpl },
    { label: "CPL", tmFmt: fmtRM(tm.cpl), lmFmt: fmtRM(lm.cpl), mom: mom.cpl ?? null, kpiFmt: fmtRM(kpi.cpl), inverted: true, tmRaw: tm.cpl, kpiRaw: kpi.cpl },
    { label: "Contact", tmFmt: String(tm.contact), lmFmt: String(lm.contact), mom: mom.contact ?? null, kpiFmt: String(kpi.target_contact), inverted: false, tmRaw: tm.contact, kpiRaw: kpi.target_contact },
    { label: "Respond Rate", tmFmt: `${tm.respond_rate.toFixed(1)}%`, lmFmt: `${lm.respond_rate.toFixed(1)}%`, mom: mom.respond_rate ?? null, kpiFmt: `${kpi.respond_rate}%`, inverted: false, tmRaw: tm.respond_rate, kpiRaw: kpi.respond_rate },
    { label: "Appointment", tmFmt: String(tm.appointment), lmFmt: String(lm.appointment), mom: mom.appointment ?? null, kpiFmt: String(kpi.target_appt), inverted: false, tmRaw: tm.appointment, kpiRaw: kpi.target_appt },
    { label: "Appt Rate", tmFmt: `${tm.appt_rate.toFixed(1)}%`, lmFmt: `${lm.appt_rate.toFixed(1)}%`, mom: mom.appt_rate ?? null, kpiFmt: `${kpi.appt_rate}%`, inverted: false, tmRaw: tm.appt_rate, kpiRaw: kpi.appt_rate },
    { label: "Est. Show Up", tmFmt: String(tm.est_showup), lmFmt: String(lm.est_showup), mom: null, kpiFmt: "—", inverted: false, tmRaw: null, kpiRaw: null },
    { label: "Show Up", tmFmt: String(tm.showup), lmFmt: String(lm.showup), mom: mom.showup ?? null, kpiFmt: String(kpi.target_showup), inverted: false, tmRaw: tm.showup, kpiRaw: kpi.target_showup },
    { label: "Show Up Rate", tmFmt: `${tm.showup_rate.toFixed(1)}%`, lmFmt: `${lm.showup_rate.toFixed(1)}%`, mom: mom.showup_rate ?? null, kpiFmt: `${kpi.showup_rate}%`, inverted: false, tmRaw: tm.showup_rate, kpiRaw: kpi.showup_rate },
    { label: "Orders", tmFmt: String(tm.orders), lmFmt: String(lm.orders), mom: mom.orders ?? null, kpiFmt: String(kpi.orders), inverted: false, tmRaw: tm.orders, kpiRaw: kpi.orders },
    { label: "Conv Rate", tmFmt: `${tm.conv_rate.toFixed(1)}%`, lmFmt: `${lm.conv_rate.toFixed(1)}%`, mom: mom.conv_rate ?? null, kpiFmt: `${kpi.conv_rate}%`, inverted: false, tmRaw: tm.conv_rate, kpiRaw: kpi.conv_rate },
    { label: "AOV", tmFmt: fmtRM(tm.aov), lmFmt: fmtRM(lm.aov), mom: mom.aov ?? null, kpiFmt: fmtRM(kpi.aov), inverted: false, tmRaw: tm.aov, kpiRaw: kpi.aov },
    { label: "ROAS", tmFmt: fmtROAS(tm.roas), lmFmt: fmtROAS(lm.roas), mom: mom.roas ?? null, kpiFmt: fmtROAS(kpi.roas), inverted: false, tmRaw: tm.roas, kpiRaw: kpi.roas },
    { label: "CPA%", tmFmt: `${tm.cpa_pct.toFixed(2)}%`, lmFmt: `${lm.cpa_pct.toFixed(2)}%`, mom: mom.cpa_pct ?? null, kpiFmt: `${kpi.cpa_pct}%`, inverted: true, tmRaw: tm.cpa_pct, kpiRaw: kpi.cpa_pct },
  ];
}

function momColor(v: number | null, inv: boolean): string {
  if (v === null) return "text-[#78716C]";
  const improving = (v > 0 && !inv) || (v < 0 && inv);
  if (Math.abs(v) < 5) return "text-[#CA8A04] font-semibold";
  return improving ? "text-[#16A34A] font-semibold" : "text-[#DC2626] font-semibold";
}

export function MoMTable({ tm, lm, mom, kpi, thisMonth, lastMonth }: {
  tm: FunnelMetrics; lm: FunnelMetrics; mom: MoMResult; kpi: KPIConfig; thisMonth: string; lastMonth: string;
}) {
  const rows = buildRows(tm, lm, mom, kpi);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#F5F5F4]">
            {["Metric", thisMonth, lastMonth, "MoM%", "KPI"].map(h => (
              <th key={h} className="text-left p-3 text-[10px] uppercase tracking-widest text-[#78716C] font-[family-name:var(--font-geist-mono)] border-b border-[rgba(214,211,209,0.5)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const kc = kpiColorClass(r.tmRaw, r.kpiRaw, r.inverted);
            const kpiCls = kc === "text-signal-green" ? "text-[#16A34A]" : kc === "text-signal-red" ? "text-[#DC2626]" : kc === "text-signal-amber" ? "text-[#CA8A04]" : "";
            return (
              <tr key={r.label} className="hover:bg-[#FAFAF9] transition-colors border-b border-[rgba(214,211,209,0.3)]">
                <td className="p-3 font-semibold text-[#1C1917] whitespace-nowrap text-[13px]">{r.label}</td>
                <td className={`p-3 font-[family-name:var(--font-geist-mono)] text-[13px] ${kpiCls} font-semibold`}>{r.tmFmt}</td>
                <td className="p-3 font-[family-name:var(--font-geist-mono)] text-[13px] text-[#78716C]">{r.lmFmt}</td>
                <td className={`p-3 font-[family-name:var(--font-geist-mono)] text-[13px] ${momColor(r.mom, r.inverted)}`}>
                  {r.mom !== null ? `${r.mom > 0 ? "+" : ""}${r.mom.toFixed(1)}%` : "N/A"}
                </td>
                <td className="p-3 font-[family-name:var(--font-geist-mono)] text-[13px] text-[#78716C]">{r.kpiFmt}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
