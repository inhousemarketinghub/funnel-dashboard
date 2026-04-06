"use client";

import { useState } from "react";
import type { FunnelMetrics, KPIConfig, Achievement } from "@/lib/types";
import { fmtRM } from "@/lib/utils";
import { CountUp } from "@/components/animations/count-up";

interface Props {
  metrics: FunnelMetrics;
  kpi: KPIConfig;
  achievement: Achievement;
  prevMetrics: FunnelMetrics;
  days: number;
  funnelType?: "appointment" | "walkin" | string;
}

function statusLabel(ach: number): { text: string; color: string; bg: string } {
  if (ach >= 100) return { text: "Excellent", color: "var(--green)", bg: "var(--green-bg)" };
  if (ach >= 80) return { text: "Warning", color: "var(--yellow)", bg: "var(--yellow-bg)" };
  return { text: "Poor", color: "var(--red)", bg: "var(--red-bg)" };
}

const ACCENT_COLORS = [
  "accent-red", "accent-blue", "accent-yellow", "accent-black", "accent-red",
  "accent-blue", "accent-yellow", "accent-black", "accent-red", "accent-blue",
];

interface CardDef {
  label: string;
  value: string;
  rawValue: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  kpiLabel: string;
  achievement: number;
  expandContent?: React.ReactNode;
}

export function HeroCards({ metrics: tm, kpi, achievement: ach, prevMetrics: lm, days, funnelType = "appointment" }: Props) {
  const isWalkin = funnelType === "walkin";
  const avgDaily = days > 0 ? tm.ad_spend / days : 0;

  // Walk-in: Conv Rate = Orders/Visit, Visit Rate = Visit/Inquiry
  const walkinConvRate = tm.contact > 0 ? (tm.orders / tm.contact) * 100 : 0;
  const visitRate = tm.inquiry > 0 ? (tm.contact / tm.inquiry) * 100 : 0;

  const cards: CardDef[] = isWalkin ? [
    // Walk-in Row 1 (4 cards)
    { label: "Total Sales", value: fmtRM(tm.sales), rawValue: tm.sales, prefix: "RM", decimals: 2, kpiLabel: `Target: ${fmtRM(kpi.sales)}`, achievement: ach.sales },
    { label: "Total Ad Spend", value: fmtRM(tm.ad_spend), rawValue: tm.ad_spend, prefix: "RM", decimals: 2, kpiLabel: `Target: ${fmtRM(kpi.ad_spend)}`, achievement: ach.ad_spend,
      expandContent: (<div className="flex gap-4"><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Avg. Daily</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{fmtRM(avgDaily)}</div></div><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Daily Budget (Inc. SST)</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{fmtRM(kpi.daily_ad)}</div></div></div>),
    },
    { label: "CPA%", value: `${tm.cpa_pct.toFixed(2)}%`, rawValue: tm.cpa_pct, suffix: "%", decimals: 2, kpiLabel: `Target: ${kpi.cpa_pct}%`, achievement: tm.cpa_pct > 0 ? (kpi.cpa_pct / tm.cpa_pct) * 100 : 0 },
    { label: "Orders", value: String(tm.orders), rawValue: tm.orders, kpiLabel: `Target: ${kpi.orders}`, achievement: ach.orders },
    // Walk-in Row 2 (4 cards)
    { label: "CPL", value: fmtRM(tm.cpl), rawValue: tm.cpl, prefix: "RM", decimals: 2, kpiLabel: `Target: ${fmtRM(kpi.cpl)}`, achievement: ach.cpl,
      expandContent: (<div className="flex gap-4"><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Inquiry (PM)</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.inquiry}</div></div></div>),
    },
    { label: "Visit Rate", value: `${visitRate.toFixed(1)}%`, rawValue: visitRate, suffix: "%", decimals: 1, kpiLabel: `Target: ${kpi.respond_rate || "-"}%`, achievement: kpi.respond_rate ? (visitRate / kpi.respond_rate) * 100 : 0,
      expandContent: (<div className="flex gap-4"><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Visit</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.contact}</div></div><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Inquiry</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.inquiry}</div></div></div>),
    },
    { label: "Conversion Rate", value: `${walkinConvRate.toFixed(1)}%`, rawValue: walkinConvRate, suffix: "%", decimals: 1, kpiLabel: `Target: ${kpi.conv_rate}%`, achievement: kpi.conv_rate ? (walkinConvRate / kpi.conv_rate) * 100 : 0,
      expandContent: (<div className="flex gap-4"><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Orders</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.orders}</div></div><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Visit</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.contact}</div></div></div>),
    },
    { label: "AOV", value: fmtRM(tm.aov), rawValue: tm.aov, prefix: "RM", decimals: 2, kpiLabel: `Target: ${fmtRM(kpi.aov)}`, achievement: ach.aov },
  ] : [
    // Appointment Row 1 (5 cards)
    { label: "Total Sales", value: fmtRM(tm.sales), rawValue: tm.sales, prefix: "RM", decimals: 2, kpiLabel: `Target: ${fmtRM(kpi.sales)}`, achievement: ach.sales },
    { label: "Total Ad Spend", value: fmtRM(tm.ad_spend), rawValue: tm.ad_spend, prefix: "RM", decimals: 2, kpiLabel: `Target: ${fmtRM(kpi.ad_spend)}`, achievement: ach.ad_spend,
      expandContent: (<div className="flex gap-4"><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Avg. Daily</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{fmtRM(avgDaily)}</div></div><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Daily Budget (Inc. SST)</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{fmtRM(kpi.daily_ad)}</div></div></div>),
    },
    { label: "CPA%", value: `${tm.cpa_pct.toFixed(2)}%`, rawValue: tm.cpa_pct, suffix: "%", decimals: 2, kpiLabel: `Target: ${kpi.cpa_pct}%`, achievement: tm.cpa_pct > 0 ? (kpi.cpa_pct / tm.cpa_pct) * 100 : 0 },
    { label: "Orders", value: String(tm.orders), rawValue: tm.orders, kpiLabel: `Target: ${kpi.orders}`, achievement: ach.orders },
    { label: "AOV", value: fmtRM(tm.aov), rawValue: tm.aov, prefix: "RM", decimals: 2, kpiLabel: `Target: ${fmtRM(kpi.aov)}`, achievement: ach.aov },
    // Appointment Row 2 (5 cards)
    { label: "CPL", value: fmtRM(tm.cpl), rawValue: tm.cpl, prefix: "RM", decimals: 2, kpiLabel: `Target: ${fmtRM(kpi.cpl)}`, achievement: ach.cpl,
      expandContent: (<div className="flex gap-4"><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Inquiry (PM)</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.inquiry}</div></div></div>),
    },
    { label: "Respond Rate", value: `${tm.respond_rate.toFixed(1)}%`, rawValue: tm.respond_rate, suffix: "%", decimals: 1, kpiLabel: `Target: ${kpi.respond_rate}%`, achievement: ach.respond_rate,
      expandContent: (<div className="flex gap-4"><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Contact Given</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.contact}</div></div><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Inquiry</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.inquiry}</div></div></div>),
    },
    { label: "Appointment Rate", value: `${tm.appt_rate.toFixed(1)}%`, rawValue: tm.appt_rate, suffix: "%", decimals: 1, kpiLabel: `Target: ${kpi.appt_rate}%`, achievement: ach.appt_rate,
      expandContent: (<div className="flex gap-4"><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Appointment</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.appointment}</div></div><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Contact Given</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.contact}</div></div></div>),
    },
    { label: "Show Up Rate", value: `${tm.showup_rate.toFixed(1)}%`, rawValue: tm.showup_rate, suffix: "%", decimals: 1, kpiLabel: `Target: ${kpi.showup_rate}%`, achievement: ach.showup_rate,
      expandContent: (<div className="flex gap-4"><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Show Up</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.showup}</div></div><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Est. Show Up</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.est_showup}</div></div></div>),
    },
    { label: "Conversion Rate", value: `${tm.conv_rate.toFixed(1)}%`, rawValue: tm.conv_rate, suffix: "%", decimals: 1, kpiLabel: `Target: ${kpi.conv_rate}%`, achievement: ach.conv_rate,
      expandContent: (<div className="flex gap-4"><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Orders</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.orders}</div></div><div><div className="text-[10px] text-[var(--t4)] uppercase tracking-wider mb-1">Show Up</div><div className="num text-[15px] font-semibold text-[var(--t1)]">{tm.showup}</div></div></div>),
    },
  ];

  return (
    <>
      {cards.map((card, i) => (
        <KPICard key={card.label} card={card} accent={ACCENT_COLORS[i]} />
      ))}
    </>
  );
}

function KPICard({ card, accent }: { card: CardDef; accent: string }) {
  const [open, setOpen] = useState(false);
  const status = statusLabel(card.achievement);

  return (
    <div
      className={`card-base accent-top ${accent} ${open ? "accordion-open" : ""}`}
      style={{ cursor: card.expandContent ? "pointer" : "default", userSelect: "none" }}
      onClick={() => card.expandContent && setOpen(!open)}
    >
      <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)] mb-1">
        {card.label}
      </div>
      <div className="text-[28px] font-bold tracking-tight text-[var(--t1)] leading-none mb-2">
        <CountUp
          value={card.rawValue}
          prefix={card.prefix}
          suffix={card.suffix}
          decimals={card.decimals}
          className="text-[28px] font-bold"
        />
      </div>
      <span
        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-[2px] rounded-full"
        style={{ background: status.bg, color: status.color }}
      >
        {status.text}
      </span>
      <div className="text-[11px] text-[var(--t3)] mt-[5px]">{card.kpiLabel}</div>

      {card.expandContent && (
        <>
          <div className="accordion-detail">
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
              {card.expandContent}
            </div>
          </div>
          <span className="accordion-hint" style={{ position: "absolute", bottom: 8, right: 12 }}>
            &#9662;
          </span>
        </>
      )}
    </div>
  );
}
