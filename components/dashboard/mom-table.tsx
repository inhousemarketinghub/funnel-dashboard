import type { FunnelMetrics, KPIConfig, MoMResult } from "@/lib/types";
import { fmtRM, fmtROAS } from "@/lib/utils";

interface FunnelRow {
  label: string;
  tmFmt: string;
  lmFmt: string;
  mom: number | null;
  kpiFmt: string;
  inverted: boolean;
}

function buildRows(
  tm: FunnelMetrics,
  lm: FunnelMetrics,
  mom: MoMResult,
  kpi: KPIConfig,
  funnelType: string = "appointment"
): FunnelRow[] {
  const isWalkin = funnelType === "walkin";
  const walkinConvRate = tm.contact > 0 ? (tm.orders / tm.contact) * 100 : 0;
  const walkinConvRatePrev = lm.contact > 0 ? (lm.orders / lm.contact) * 100 : 0;
  const walkinConvMom = walkinConvRatePrev > 0 ? ((walkinConvRate - walkinConvRatePrev) / walkinConvRatePrev) * 100 : null;
  const visitRate = tm.inquiry > 0 ? (tm.contact / tm.inquiry) * 100 : 0;
  const visitRatePrev = lm.inquiry > 0 ? (lm.contact / lm.inquiry) * 100 : 0;
  const visitRateMom = visitRatePrev > 0 ? ((visitRate - visitRatePrev) / visitRatePrev) * 100 : null;

  const rows: FunnelRow[] = [
    { label: "Ad Spend", tmFmt: fmtRM(tm.ad_spend), lmFmt: fmtRM(lm.ad_spend), mom: mom.ad_spend ?? null, kpiFmt: fmtRM(kpi.ad_spend), inverted: false },
    { label: "Inquiry (PM)", tmFmt: String(tm.inquiry), lmFmt: String(lm.inquiry), mom: mom.inquiry ?? null, kpiFmt: kpi.cpl > 0 ? String(Math.round(kpi.ad_spend / kpi.cpl)) : "—", inverted: false },
    { label: isWalkin ? "Visit" : "Contact", tmFmt: String(tm.contact), lmFmt: String(lm.contact), mom: mom.contact ?? null, kpiFmt: String(kpi.target_contact), inverted: false },
    { label: isWalkin ? "Visit Rate" : "Respond Rate", tmFmt: isWalkin ? `${visitRate.toFixed(1)}%` : `${tm.respond_rate.toFixed(1)}%`, lmFmt: isWalkin ? `${visitRatePrev.toFixed(1)}%` : `${lm.respond_rate.toFixed(1)}%`, mom: isWalkin ? visitRateMom : (mom.respond_rate ?? null), kpiFmt: `${kpi.respond_rate}%`, inverted: false },
  ];

  if (!isWalkin) {
    rows.push(
      { label: "Appointment", tmFmt: String(tm.appointment), lmFmt: String(lm.appointment), mom: mom.appointment ?? null, kpiFmt: String(kpi.target_appt), inverted: false },
      { label: "Appt Rate", tmFmt: `${tm.appt_rate.toFixed(1)}%`, lmFmt: `${lm.appt_rate.toFixed(1)}%`, mom: mom.appt_rate ?? null, kpiFmt: `${kpi.appt_rate}%`, inverted: false },
      { label: "Est. Show Up", tmFmt: String(tm.est_showup), lmFmt: String(lm.est_showup), mom: null, kpiFmt: "\u2014", inverted: false },
      { label: "Show Up", tmFmt: String(tm.showup), lmFmt: String(lm.showup), mom: mom.showup ?? null, kpiFmt: String(kpi.target_showup), inverted: false },
      { label: "Show Up Rate", tmFmt: `${tm.showup_rate.toFixed(1)}%`, lmFmt: `${lm.showup_rate.toFixed(1)}%`, mom: mom.showup_rate ?? null, kpiFmt: `${kpi.showup_rate}%`, inverted: false },
    );
  }

  rows.push(
    { label: "Orders", tmFmt: String(tm.orders), lmFmt: String(lm.orders), mom: mom.orders ?? null, kpiFmt: String(kpi.orders), inverted: false },
    { label: "Conv Rate", tmFmt: isWalkin ? `${walkinConvRate.toFixed(1)}%` : `${tm.conv_rate.toFixed(1)}%`, lmFmt: isWalkin ? `${walkinConvRatePrev.toFixed(1)}%` : `${lm.conv_rate.toFixed(1)}%`, mom: isWalkin ? walkinConvMom : (mom.conv_rate ?? null), kpiFmt: `${kpi.conv_rate}%`, inverted: false },
    { label: "Sales", tmFmt: fmtRM(tm.sales), lmFmt: fmtRM(lm.sales), mom: mom.sales ?? null, kpiFmt: fmtRM(kpi.sales), inverted: false },
    { label: "AOV", tmFmt: fmtRM(tm.aov), lmFmt: fmtRM(lm.aov), mom: mom.aov ?? null, kpiFmt: fmtRM(kpi.aov), inverted: false },
    { label: "ROAS", tmFmt: fmtROAS(tm.roas), lmFmt: fmtROAS(lm.roas), mom: mom.roas ?? null, kpiFmt: fmtROAS(kpi.roas), inverted: false },
    { label: "CPA%", tmFmt: `${tm.cpa_pct.toFixed(2)}%`, lmFmt: `${lm.cpa_pct.toFixed(2)}%`, mom: mom.cpa_pct ?? null, kpiFmt: `${kpi.cpa_pct}%`, inverted: true },
  );

  return rows;
}

/**
 * Determine whether a MoM change is "good" or "bad".
 * For normal metrics: positive = good. For inverted metrics (CPL, CPA%): negative = good.
 */
function momBadge(v: number | null, inverted: boolean) {
  if (v === null) return <span className="text-[13px] text-[var(--t4)] num">N/A</span>;
  const isGood = inverted ? v < 0 : v > 0;
  const cls = isGood ? "chg chg-up" : "chg chg-dn";
  const sign = v > 0 ? "+" : "";
  return <span className={cls}>{sign}{v.toFixed(1)}%</span>;
}

const TH =
  "font-label text-[10px] uppercase tracking-widest text-[var(--t4)] text-left";
const TD = "text-[13px] text-[var(--t1)] num";

export function MoMTable({
  tm,
  lm,
  mom,
  kpi,
  thisMonth,
  lastMonth,
  funnelType = "appointment",
}: {
  tm: FunnelMetrics;
  lm: FunnelMetrics;
  mom: MoMResult;
  kpi: KPIConfig;
  thisMonth: string;
  lastMonth: string;
  funnelType?: string;
}) {
  const rows = buildRows(tm, lm, mom, kpi, funnelType);

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className={TH} style={{ padding: "10px 16px" }}>
              Metric
            </th>
            <th className={TH} style={{ padding: "10px 16px" }}>
              {thisMonth}
            </th>
            <th className={TH} style={{ padding: "10px 16px" }}>
              {lastMonth}
            </th>
            <th className={TH} style={{ padding: "10px 16px" }}>
              PoP
            </th>
            <th className={TH} style={{ padding: "10px 16px" }}>
              KPI
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              className="border-b border-[var(--border)] hover:bg-[var(--bg3)] transition-colors"
            >
              <td
                className="text-[13px] font-medium text-[var(--t1)]"
                style={{ padding: "12px 16px" }}
              >
                {r.label}
              </td>
              <td className={TD} style={{ padding: "12px 16px" }}>
                {r.tmFmt}
              </td>
              <td
                className="text-[13px] text-[var(--t4)] num"
                style={{ padding: "12px 16px" }}
              >
                {r.lmFmt}
              </td>
              <td style={{ padding: "12px 16px" }}>
                {momBadge(r.mom, r.inverted)}
              </td>
              <td
                className="text-[13px] text-[var(--t4)] num"
                style={{ padding: "12px 16px" }}
              >
                {r.kpiFmt}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
